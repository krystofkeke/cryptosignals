# Crypto signály 24/7 (běží na GitHubu, zdarma)

Tohle je „server", co běží pořád v cloudu — počítá signály a posílá je do **Telegram skupiny**,
takže notifikace chodí **i když máš PC vypnuté**, a **všichni ve skupině dostanou stejnou zprávu**.

## Co potřebuješ
- účet na GitHubu (zdarma)
- Telegram bota (token od @BotFather)
- Telegram **skupinu**, kde je bot a všichni, co mají dostávat signály

---

## 1) Založ Telegram skupinu a zjisti její ID
1. V Telegramu vytvoř **novou skupinu**, přidej do ní sebe, kámoše a **svého bota**.
2. Zjisti **ID skupiny**: do skupiny přidej bota **@RawDataBot** (nebo @getidsbot) — napíše ti
   `"chat":{"id":-1001234567890 ...}`. To číslo (i s mínusem) je tvoje **CHAT ID**. Pak @RawDataBot ze skupiny odeber.
   - ID skupiny je **záporné číslo** (začíná `-100...`).

## 2) Nahraj tenhle scanner na GitHub
1. Jdi na **github.com** → přihlas se → vpravo nahoře **+** → **New repository**.
2. Jméno třeba `crypto-signals`, zvol **Public** (u public repa jsou Actions zdarma bez limitu), **Create**.
3. **Add file → Upload files** → nahraj sem `scanner.js` a `state.json`.
4. Znovu **Add file → Create new file** → do jména napiš přesně:
   `.github/workflows/scan.yml` (lomítka udělají složky) → vlož obsah souboru `scan.yml` → **Commit**.

## 3) Vlož tajné klíče (token + chat)
1. V repu nahoře **Settings → Secrets and variables → Actions → New repository secret**.
2. Přidej dva:
   - Name: `TELEGRAM_TOKEN` → Value: token od @BotFather
   - Name: `TELEGRAM_CHAT` → Value: ID skupiny (to záporné číslo)

## 4) Zapni a otestuj
1. Nahoře **Actions** → pokud se ptá, klikni **I understand… enable workflows**.
2. Vlevo vyber **Crypto signaly 24/7** → vpravo **Run workflow** → **Run** (ruční test).
3. Za chvíli by měla do skupiny přijít zpráva. Od té chvíle to jede **samo každých ~15 minut**, 24/7.

---

## Nastavení (v `scanner.js` nahoře)
- `COINS` – které mince hlídat
- `MIN_WIN` – minimální úspěšnost pro poslání (výchozí 66 %)
- `COOLDOWN_MS` – jak dlouho neposílat stejný signál znovu (3 h)
- `HOURLY_TIP` – když nic silného, jednou za hodinu pošle nejlepší nápad

## Poznámky
- GitHub cron může spuštění o pár minut **zpozdit** (normální).
- Když upravíš `COINS` nebo cokoli, nahraj nový `scanner.js` (Add file → Upload → přepíše).
- ⚠️ Signály jsou odhad, ne jistota. Vždy stop-loss, malá/žádná páka.
