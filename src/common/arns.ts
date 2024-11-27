/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ReadThroughPromiseCache } from '@ardrive/ardrive-promise-cache';
import { connect } from '@permaweb/aoconnect';
import { pLimit } from 'plimit-lit';

import { AoClient } from '../types/common.js';
import { AoArNSNameData, AoIORead } from '../types/io.js';
import { fetchAllArNSRecords } from '../utils/index.js';
import { ANT } from './ant.js';
import { AOProcess } from './contracts/ao-process.js';
import { IO } from './io.js';
import { Logger } from './logger.js';

export type ArNSUnresolvedData = {
  name: string;
  txId: undefined;
  ttlSeconds: undefined;
  processId: undefined | string;
};

export type ArNSResolvedData =
  | ArNSUnresolvedData
  | {
      name: string;
      txId: string;
      type: 'lease' | 'permabuy';
      ttlSeconds: number;
      processId: string;
    };
export type ArNSLookupData = string[];

export interface ArNSNameResolver {
  /**
   * Returns the data associated with an ArNS Name (including undernames)
   * @param params
   */
  resolve(params: { name: string }): Promise<ArNSResolvedData | undefined>;
  /**
   * Returns all base ArNS Names associated with a given transaction id
   * @param params
   */
  lookup(params: { txId: string }): Promise<ArNSLookupData>;
}

export class ArNSResolver {
  private readonly io: AoIORead;
  private readonly logger: Logger;
  private readonly txCache: ReadThroughPromiseCache<string, string[]>;
  private readonly fullNameCache: ReadThroughPromiseCache<
    string,
    Record<string, AoArNSNameData>
  >;
  private readonly namesCache: ReadThroughPromiseCache<
    string,
    ArNSResolvedData
  >;

  private readonly ao: AoClient;
  constructor({
    io = IO.init(),
    ao = connect(),
    logger = Logger.default,
  }: {
    io?: AoIORead;
    ao?: AoClient;
    logger?: Logger;
  }) {
    this.io = io;
    this.logger = logger;
    this.ao = ao;
    this.fullNameCache = new ReadThroughPromiseCache<
      string,
      Record<string, AoArNSNameData>
    >({
      cacheParams: {
        cacheTTL: 1000 * 60 * 60, // 1 hour
        cacheCapacity: 1000,
      },
      readThroughFunction: async () => {
        const records = await fetchAllArNSRecords({
          contract: this.io,
        });
        return records;
      },
    });
    this.namesCache = new ReadThroughPromiseCache<string, ArNSResolvedData>({
      cacheParams: {
        cacheTTL: 1000 * 60 * 60, // 1 hour
        cacheCapacity: 1000,
      },
      readThroughFunction: async (name) => {
        // split name based on underscore, last element is the apex name
        const nameParts = name.split('_');
        const apexName = nameParts[nameParts.length - 1];
        const undername = nameParts.slice(0, -1).join('_') || '@';

        // get the process id
        const record = await this.io.getArNSRecord({ name: apexName });

        if (!record) {
          return {
            name,
            txId: undefined,
            type: undefined,
            ttlSeconds: undefined,
            processId: undefined,
          };
        }

        const ant = ANT.init({
          process: new AOProcess({
            processId: record.processId,
            ao: this.ao,
            logger: this.logger,
          }),
        });

        // incase the undername is not set or ant is not spec compliant, catch any errors and return undefined
        const undernameRecord = await ant.getRecord({ undername }).catch(() => {
          return undefined;
        });

        if (
          !undernameRecord ||
          !undernameRecord?.transactionId ||
          undernameRecord.transactionId === '' ||
          undernameRecord.transactionId === undefined
        ) {
          return {
            name,
            txId: undefined,
            type: record.type,
            ttlSeconds: undefined,
            processId: record.processId,
          };
        }
        return {
          name,
          txId: undernameRecord?.transactionId,
          type: record.type,
          ttlSeconds: undernameRecord?.ttlSeconds,
          processId: record.processId,
        };
      },
    });
    this.txCache = new ReadThroughPromiseCache<string, string[]>({
      cacheParams: {
        cacheTTL: 1000 * 60 * 60, // 1 hour
        cacheCapacity: 1000,
      },
      readThroughFunction: async (txId) => {
        const records = await this.fullNameCache.get('names');
        const throttle = pLimit(1000);
        const promises = Object.entries(records).map(async ([name, record]) =>
          throttle(async () => {
            const ant = ANT.init({
              process: new AOProcess({
                processId: record.processId,
                ao: this.ao,
                logger: this.logger,
              }),
            });
            // incase the ant is not spec compliant, catch any errors and continue
            const antRecords = await ant.getRecords().catch(() => {
              return {};
            });
            for (const [undername, undernameRecord] of Object.entries(
              antRecords,
            )) {
              console.log(
                `${undername === '@' ? `${name}` : `${undername}_${name}`}`,
              );
              if (undernameRecord.transactionId === txId) {
                return `${undername === '@' ? `${name}` : `${undername}_${name}`}`;
              }
            }
            return undefined;
          }),
        );
        const results = await Promise.all(promises);
        const fullListOfAffiliatedNames = new Set<string>(
          results.filter((result): result is string => result !== undefined),
        );
        return Array.from(fullListOfAffiliatedNames);
      },
    });
  }

  /**
   * Returns the data associated with an ArNS Name (including undernames)
   * @param params
   */
  async resolve({ name }: { name: string }): Promise<ArNSResolvedData> {
    return this.namesCache.get(name);
  }

  /**
   * Returns all the known ArNS Names associated with a given process id
   * @param params
   */
  async lookup({ processId }: { processId: string }): Promise<ArNSLookupData> {
    return this.txCache.get(processId);
  }
}
