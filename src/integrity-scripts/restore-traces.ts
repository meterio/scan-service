#!/usr/bin/env node
require('../utils/validateEnv');

import { HeadRepo, TxRepo, ContractRepo } from '../repo';
import { TraceOutput } from '../model';
import { connectDB, disconnectDB } from '../utils/db';
import { prototype, ZeroAddress } from '../const';
import { Keccak } from 'sha3';

import { checkNetworkWithDB, isTraceable, Pos, runWithOptions, sleep } from '../utils';

const runAsync = async (options) => {
  const { network, standby } = options;

  await connectDB(network, standby);
  const headRepo = new HeadRepo();
  const txRepo = new TxRepo();
  const pos = new Pos(network);
  const contractRepo = new ContractRepo();
  await checkNetworkWithDB(network);

  const posHead = await headRepo.findByKey('pos');
  const best = posHead.num;
  const step = 5000;

  for (let i = 0; i < best; i += step) {
    const start = i;
    const end = i + step - 1 > best ? best : i + step - 1;

    const txs = await txRepo.findUserTxsInBlockRangeSortAsc(start, end);
    console.log(`searching for txs in blocks [${start}, ${end}]`);
    for (const tx of txs) {
      console.log(`blk:${tx.block.number}, processing tx ${tx.hash}`);

      if (tx.traces.length > 0 || tx.origin === ZeroAddress) {
        // skip tx with traces
        console.log('traces exists or origin is 0x00..00, skip tx: ', tx.hash);
        continue;
      }

      let traces: TraceOutput[] = [];
      for (const [clauseIndex, clause] of tx.clauses.entries()) {
        let tracer: Pos.CallTracerOutput;
        if (isTraceable(tx.clauses[clauseIndex].data)) {
          try {
            tracer = await pos.traceClause(tx.block.hash, tx.hash, clauseIndex);
            traces.push({ json: JSON.stringify(tracer), clauseIndex });
          } catch (e) {
            console.log('error getting 1st trace for tx:', tx.hash, 'sleep for 5 seconds');
            await sleep(5000);
            try {
              tracer = await pos.traceClause(tx.block.hash, tx.hash, clauseIndex);
              traces.push({ json: JSON.stringify(tracer), clauseIndex });
            } catch (e) {
              console.log('error getting 2nd trace for tx: ', tx.hash);
              console.log('skip this tx for now');
              continue;
            }
          }
        } else {
          // if it's not traceable, it's not likely it's a contract creation tx
          console.log(`clause ${clauseIndex} not traceable, skip`);
          continue;
        }

        // try to find contract creation event
        if (tx.outputs && tx.outputs[clauseIndex]) {
          const o = tx.outputs[clauseIndex];
          for (const [logIndex, evt] of o.events.entries()) {
            if (evt.topics && evt.topics[0] === prototype.$Master.signature) {
              // contract creation tx
              const contract = await contractRepo.findByAddress(evt.address);

              // find creationInput in tracing
              let q = [tracer];
              let creationInputHash = '';
              console.log(`analyze traces of clause ${clauseIndex} on tx ${tx.hash}`);
              while (q.length > 0) {
                const node = q.shift();
                if (node.calls) {
                  for (const c of node.calls) {
                    q.push(c);
                  }
                }
                if ((node.type === 'CREATE' || node.type === 'CREATE2') && node.to === evt.address) {
                  const creationInput = node.input;
                  const hash = new Keccak(256);
                  hash.update(creationInput.replace('0x', ''));
                  creationInputHash = hash.digest('hex');
                  break;
                }
              }

              if (creationInputHash !== '') {
                if (!contract.verified) {
                  // if contract is unverified, try to do a code-match
                  const verifiedContract = await contractRepo.findVerifiedContractsWithCreationInputHash(
                    creationInputHash
                  );
                  if (verifiedContract) {
                    contract.verified = true;
                    contract.status = 'match';
                    contract.verifiedFrom = verifiedContract.address;
                    contract.creationInputHash = creationInputHash;
                    console.log(`update contract ${contract.address} with code-match verification`);
                    await contract.save();
                  }
                }

                if (contract.creationInputHash !== creationInputHash) {
                  contract.creationInputHash = creationInputHash;
                  console.log(`update contract ${contract.address} with new creationInputHash`);
                  await contract.save();
                }
              }
            }
          }
        }
        console.log('processed tx: ', tx.hash);
      }

      if (traces.length > 0) {
        tx.traces = traces;
        console.log(`update tx ${tx.hash} with ${traces.length} traces`);
        await tx.save();
      }
    }
  }
};

(async () => {
  try {
    await runWithOptions(runAsync);
    await disconnectDB();
  } catch (e) {
    console.log(`error: ${e.name} ${e.message} - ${e.stack}`);
    process.exit(-1);
  }
})();
