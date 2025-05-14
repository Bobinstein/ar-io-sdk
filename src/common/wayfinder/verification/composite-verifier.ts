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

/**
 * TODO: a composite verifier that supports bundle verification, data item verification, and data item verification with offsets
 * - hash verifier
 * - data root verifier
 * - parent chunks verifier
 */
import { Readable } from 'stream';

import { DataClassifier, DataVerifier } from '../../../types/wayfinder.js';

export class CompositeVerifier implements DataVerifier {
  private bundleVerifiers: DataVerifier[];
  private dataItemVerifiers: DataVerifier[];
  private classifier: DataClassifier;
  /**
   * TODO: how to provide various configurations to determine how to verify based on the type of data (L1 vs. L2) and what logic is used to to determine the verifier
   *
   * How do we surface that configuration to clients to specify what verifiers to use when.
   *
   */
  constructor({
    bundleVerifiers,
    dataItemVerifiers,
    classifier,
  }: {
    bundleVerifiers: DataVerifier[];
    dataItemVerifiers: DataVerifier[];
    classifier: DataClassifier;
  }) {
    this.bundleVerifiers = bundleVerifiers;
    this.dataItemVerifiers = dataItemVerifiers;
    this.classifier = classifier;
  }

  async verifyData({
    data,
    txId,
  }: {
    data: Buffer | Readable | ReadableStream;
    txId: string;
  }): Promise<void> {
    const type = await this.classifier.classify({ txId });
    if (type === 'bundle') {
      await Promise.all(
        this.bundleVerifiers.map((verifier) =>
          verifier.verifyData({ data, txId }),
        ),
      );
    } else {
      await Promise.all(
        this.dataItemVerifiers.map((verifier) =>
          verifier.verifyData({ data, txId }),
        ),
      );
    }
  }
}
