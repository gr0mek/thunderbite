# mvp-cloud-version — Product Manager

## Users
The owner (admin) plus a few invited friends. Polish UI, as in the extension.

## User stories (MVP)
1. As the admin I create an invite code in the bot and send it to a friend.
2. As a friend I send `/start <code>` to the bot and get an account; `/panel` gives me a login link.
3. As a user I add, edit, pause and delete watches (keywords, exclusions, price, condition, interval, deal mode), in the panel or with basic bot commands.
4. As a user I get a Telegram message for each new match or deal: photo, price, discount, link, Hide/Open buttons.
5. As a user I see my offers and the market price per watch in the panel.
6. As a user I see when Vinted scanning is failing and why (error code + hint).
7. (Stage 5) As a user I add a Discord webhook as a second channel.

## Success criteria
- Scanning keeps running for 7 days with the browser closed, with at most 1 h of total Vinted-block downtime per day.
- A new matching listing reaches Telegram within the watch interval + 1 min.
- No duplicate notifications for the same listing and watch.
- A friend goes from invite to first notification in under 5 minutes.

## Out of scope
Public sign-up, payments, email from the server, extension↔server sync, other marketplaces.
