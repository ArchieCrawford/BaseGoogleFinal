import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_RPC_URL = process.env.BASE_RPC_URL;

const CHAIN_ID = 8453;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);

const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

async function getState() {
  const { data, error } = await supabase
    .from("app_state")
    .select("value")
    .eq("key", "base_indexer")
    .single();
  if (error) throw error;
  return data.value;
}

async function setState(value) {
  const { error } = await supabase.from("app_state").upsert({ key: "base_indexer", value });
  if (error) throw error;
}

async function upsert(log, blockTs) {
  const id = `${CHAIN_ID}:${log.transactionHash.toLowerCase()}:${log.index}`;
  const token = log.address.toLowerCase();
  const txHash = log.transactionHash.toLowerCase();

  const raw = {
    id,
    source: "base_onchain",
    type: "erc20_transfer",
    ts: blockTs,
    chain_id: CHAIN_ID,
    block_number: Number(log.blockNumber),
    tx_hash: txHash,
    log_index: Number(log.index),
    contract: token,
    token,
    payload: { address: log.address, topics: log.topics, data: log.data },
  };

  await supabase.from("raw_events").upsert(raw, { onConflict: "id" });

  const doc = {
    doc_id: `event:base:${id}`,
    doc_type: "event",
    title: `ERC20 Transfer ${token}`,
    snippet: txHash,
    ts: blockTs,
    token,
    tx_hash: txHash,
    keywords: ["base", "transfer", token, txHash],
    body: raw,
  };

  await supabase.from("search_docs").upsert(doc, { onConflict: "doc_id" });
}

async function main() {
  const confirmations = Number(process.env.CONFIRMATIONS ?? 30);
  const chunk = Number(process.env.BLOCK_CHUNK ?? 1000);

  const state = await getState();
  let last = Number(state.last_indexed_block ?? 0);

  const latest = await provider.getBlockNumber();
  const safeTip = latest - confirmations;
  if (safeTip <= last) return;

  const blockCache = new Map();

  while (last < safeTip) {
    const fromBlock = last + 1;
    const toBlock = Math.min(fromBlock + chunk - 1, safeTip);

    const logs = await provider.getLogs({ fromBlock, toBlock, topics: [TRANSFER_TOPIC] });

    for (const log of logs) {
      const bn = Number(log.blockNumber);
      let ts = blockCache.get(bn);
      if (!ts) {
        const b = await provider.getBlock(bn);
        ts = new Date(Number(b.timestamp) * 1000).toISOString();
        blockCache.set(bn, ts);
      }
      await upsert(log, ts);
    }

    last = toBlock;
    await setState({ ...state, last_indexed_block: last, chain_id: CHAIN_ID });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
