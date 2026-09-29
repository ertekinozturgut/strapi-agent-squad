# CodeQL

`queries/strapi-security.qls` imports GitHub's JavaScript/TypeScript security-extended suite. The model pack under `.github/codeql/extensions` is auto-loaded by GitHub code scanning and adds Strapi/Koa request, MCP, CSV/XML/workbook sources plus raw SQL, redirect, outbound URL, and log sinks. Strapi-specific syntax and configuration rules are implemented in `.semgrep/strapi-security.yml`; data-flow findings are normalized with the same rule registry in squad reports.

Run through GitHub CodeQL or:

```bash
codeql database analyze <database> .codeql/queries/strapi-security.qls --format=sarif-latest --output=codeql.sarif
```
