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
import { DataClassifier } from '../../../types/wayfinder.js';
import { GatewaysProvider } from '../gateways.js';

export class GqlTxClassifier implements DataClassifier {
  private gatewaysProvider: GatewaysProvider;
  // TODO: support thresholds
  constructor({ gatewaysProvider }: { gatewaysProvider: GatewaysProvider }) {
    this.gatewaysProvider = gatewaysProvider;
  }

  async classify({ txId }: { txId: string }): Promise<'bundle' | 'data-item'> {
    const query = `
      query {
        transactions(ids: ["${txId}"]) {
          bundledIn {
            id
          }
        }
      }
    `;
    const gateways = await this.gatewaysProvider.getGateways();
    const results = await Promise.all(
      gateways.map(async (gateway) => {
        const result = await fetch(gateway, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        });
        if (!result.ok) {
          throw new Error(
            `Failed to classify transaction ${txId} on ${gateway}`,
            {
              cause: {
                status: result.status,
                statusText: result.statusText,
              },
            },
          );
        }
        const data = (await result.json()) as {
          data: {
            transactions: {
              edges: {
                node: {
                  bundledIn: { id: string } | null;
                };
              };
            };
          };
        };
        if (data.data.transactions[0].edges[0].node.bundledIn === null) {
          return 'bundle';
        }
        return 'data-item';
      }),
    );
    return results.find((result) => result !== undefined) ?? 'data-item';
  }
}
