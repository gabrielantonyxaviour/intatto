"use client"

import { useEffect } from "react"
import { useAccount, useConfig, useConnect } from "wagmi"
import { getAccount } from "wagmi/actions"
import { BURNER_CONNECTOR_ID } from "./burner"

/**
 * Safety net for sandbox mode: wagmi's reconnect normally connects the burner (it is always
 * authorized), but reconnect is skipped while another config's reconnect is still running.
 * If nothing is connected shortly after mount, connect the burner directly.
 */
export function BurnerAutoConnect() {
  const config = useConfig()
  const { status } = useAccount()
  const { connect, connectors } = useConnect()

  useEffect(() => {
    if (status !== "disconnected") return
    const burner = connectors.find((c) => c.id === BURNER_CONNECTOR_ID)
    if (!burner) return
    const timer = setTimeout(() => {
      if (getAccount(config).status === "disconnected") connect({ connector: burner })
    }, 750)
    return () => clearTimeout(timer)
  }, [status, connectors, connect, config])

  return null
}
