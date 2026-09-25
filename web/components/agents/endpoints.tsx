"use client"

import { Badge } from "@/components/ui/badge"
import { curlFor, DEMO_WALLET, ENDPOINTS, PARAMETERS, PRICE_LABEL, publicEndpointUrl } from "./content"
import { CopyButton } from "./copy-button"

export function EndpointList() {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-medium">Endpoints</h2>
      <ul className="grid gap-3">
        {ENDPOINTS.map((endpoint) => {
          const url = publicEndpointUrl(endpoint.path)
          const curl = curlFor(
            endpoint.path === "/api/credit"
              ? `${url}?wallet=${DEMO_WALLET}&market=NVDAx&network=mainnet`
              : url,
          )
          return (
            <li key={endpoint.path} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto] sm:items-start">
              <div className="grid min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">{endpoint.method}</Badge>
                  <span className="font-mono text-sm break-all">{endpoint.path}</span>
                  {endpoint.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{endpoint.description}</p>
              </div>
              <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                <span className="text-sm font-medium text-success">{PRICE_LABEL}</span>
                <div className="flex gap-1">
                  <CopyButton value={url} label={`Copy URL for ${endpoint.path}`} />
                  <CopyButton value={curl} label={`Copy curl for ${endpoint.path}`} />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function ParameterList() {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-medium">Parameters</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {PARAMETERS.map((param) => (
          <li key={param.name} className="grid gap-1 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm">{param.name}</span>
              <Badge variant={param.required ? "secondary" : "outline"}>{param.required ? "Required" : "Optional"}</Badge>
            </div>
            <p className="text-sm">{param.values}</p>
            <p className="text-sm text-muted-foreground">{param.note}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
