# The Account Aggregator (AA) framework

Account Aggregators are RBI-licensed consent managers (NBFC-AA) that let you share your own financial data between institutions — bank statements, deposits, mutual funds, insurance, and (progressively) demat holdings — without handing over passwords.

## How the flow works
1. An app (the FIU — Financial Information User, e.g. Ants) requests consent for specific data, duration, and purpose.
2. You approve via your AA handle (e.g. name@onemoney) with an OTP.
3. The data provider (FIP — your bank/RTA/depository) ships encrypted data through the AA to the FIU. The AA itself cannot read it.

## Why it beats screen-scraping and password-sharing
- Consent is granular, time-bound, and revocable from the AA app.
- Read-only: an FIU can see holdings but can never transact.
- Regulated: RBI licenses the AAs; data never gets stored by the middleman.

## Current limits
Demat/equity holdings coverage is still rolling out across depositories and RTAs, which is why apps commonly offer screenshot upload or manual entry as fallbacks. Coverage grows every quarter.
