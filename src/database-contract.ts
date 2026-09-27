/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Data-source contract for the MCP server. Production is backed by the audited
 * Postgres library; any implementation returning the same public shape works —
 * e.g. loading cases.json from the open dataset (CC BY 4.0):
 * https://github.com/lttxzmj/proofstack-dataset
 */
export declare function listCases(status?: string): Promise<any[]>;
