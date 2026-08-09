---
"@druid-ui/host": patch
---

Bundle the browser transpilation worker with Vite so its JCO runtime is available in SPA builds, and fail timed-out worker requests instead of leaving the UI stuck loading.
