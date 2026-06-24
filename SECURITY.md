# Security

This server uses authenticated browser cookies to call Nanny Lane endpoints. Treat those cookies like passwords.

## Supported Use

Use this project only with Nanny Lane accounts and local browser profiles you control. It is intended for local automation and MCP access to your own account data.

## Secret Handling

- Do not commit `.env`, `.cookies/`, browser cookie headers, session ids, or Cloudflare clearance values.
- Prefer `NANNYLANE_COOKIE_FILE` pointing outside the repository, for example `~/.config/nannylane-mcp/cookie`.
- Rotate or refresh cookies if they are exposed in a shell transcript, issue, pull request, or log.
- Review tool responses before sharing them because profile, conversation, and plan data may contain personal information.
- The browser import helper reads local browser cookies and may trigger macOS Keychain access prompts. Run it only on machines and user accounts you control.

## Local Storage

The login helper writes the default cookie file with:

```text
directory: 0700
file:      0600
```

The repository ignores common local secret locations, including `.env`, `.env.*`, `.cookies/`, and `.tmp/`. A correctly configured checkout should not need checked-in secrets.

## Side Effects

The `nannylane_send_message` tool defaults to `dryRun: true`. Set `dryRun: false` only after approving the exact recipient and message text.

## Reporting Issues

Do not include real cookies, message text, user ids, listing ids tied to real people, or account screenshots in public issues. Replace them with placeholders and describe the behavior instead.

If you find a bug that could leak credentials or send messages unexpectedly, open a private advisory or contact the maintainer privately before posting details publicly.
