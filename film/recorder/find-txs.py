import json, urllib.request
RPC="https://xlayerrpc.okx.com"
def rpc(m,p):
    r=urllib.request.Request(RPC,data=json.dumps({"jsonrpc":"2.0","id":1,"method":m,"params":p}).encode(),headers={"content-type":"application/json","user-agent":"curl/8"})
    return json.load(urllib.request.urlopen(r))["result"]
latest=int(rpc("eth_blockNumber",[]),16)
start=71562056
seen=set()
for a in range(start, latest+1, 100):
    logs=rpc("eth_getLogs",[{"address":["0xE6708CC6598F17611f9A468f9907052688459D0D","0x89fC3a0637768fA0c7e779375786bc129B6c308C"],"fromBlock":hex(a),"toBlock":hex(min(a+99,latest))}])
    for l in logs:
        if any("7f23b131" in x.lower() for x in l["topics"]) and l["transactionHash"] not in seen:
            seen.add(l["transactionHash"]); print(int(l["blockNumber"],16), l["transactionHash"], l["address"][:10], l["topics"][0][:10])
