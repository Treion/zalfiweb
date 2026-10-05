# Run ZALFI on a Windows computer, from nothing

This guide takes a Windows 10 or 11 computer with nothing installed to the shop and the admin running at `http://localhost:3000`. Every click and every command is written out. It takes about 45 minutes, most of it waiting for downloads.

Nothing here needs a paid account. Payments, SMS, email and couriers all have built-in test stand-ins on your computer.

- [Before you start](#before-you-start)
- [Part 1: Install Git](#part-1-install-git)
- [Part 2: Install Node.js](#part-2-install-nodejs)
- [Part 3: Install PostgreSQL (the database)](#part-3-install-postgresql-the-database)
- [Part 4: Open PowerShell and check the tools](#part-4-open-powershell-and-check-the-tools)
- [Part 5: Download the code](#part-5-download-the-code)
- [Part 6: The settings file](#part-6-the-settings-file)
- [Part 7: Create the database](#part-7-create-the-database)
- [Part 8: Fill the database and make your admin account](#part-8-fill-the-database-and-make-your-admin-account)
- [Part 9: Start the site](#part-9-start-the-site)
- [Part 10: Try an order](#part-10-try-an-order)
- [Every day after this](#every-day-after-this)
- [When something goes wrong](#when-something-goes-wrong)

## Before you start

- **Windows 10 or 11, 64-bit.** (Settings → System → About shows "64-bit operating system".)
- **About 5 GB of free disk space.**
- **An internet connection.**
- **Permission to install programs** (Windows will ask "Do you want to allow this app to make changes to your device?": press **Yes**).

How to read this guide: text like `this` is something you type, exactly as shown, then press **Enter**. You can copy it from here and paste it: in PowerShell, **right-click** pastes.

## Part 1: Install Git

Git downloads the code and keeps it up to date.

1. Open [git-scm.com/downloads/win](https://git-scm.com/downloads/win) in your browser.
2. Click **Click here to download** (the "64-bit Git for Windows Setup"). A file like `Git-2.xx.x-64-bit.exe` downloads.
3. Open the downloaded file. Press **Yes** when Windows asks to allow changes.
4. The installer has about fifteen screens. **Press Next on every one without changing anything**, then **Install**. The defaults are right. In particular, keep:
   - "Git from the command line and also from 3rd-party software";
   - "Checkout Windows-style, commit Unix-style line endings";
   - "Git Credential Manager".
5. On the last screen, untick **View Release Notes** and press **Finish**.

## Part 2: Install Node.js

Node.js runs the site. npm, which installs the site's building blocks, comes with it.

1. Open [nodejs.org](https://nodejs.org).
2. Download the **LTS** version (the button says "Download Node.js (LTS)"). It must be **version 22 or newer**. A file like `node-v24.x.x-x64.msi` downloads.
3. Open it and press **Next**.
4. Tick **I accept the terms in the License Agreement**, then press **Next**.
5. Press **Next** on **Destination Folder** and on **Custom Setup** without changing anything.
6. On **Tools for Native Modules**, **leave the box unticked**. The site doesn't need those tools, and they take a long time to install. Press **Next**.
7. Press **Install**, then **Yes** when Windows asks, then **Finish**.

## Part 3: Install PostgreSQL (the database)

PostgreSQL stores the orders, products, customers and admin accounts.

1. Open [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) and click **Download the installer**. It opens EDB's download page.
2. In the table, find the row for **PostgreSQL 16** (16.x, the version the site is built and tested with). In the **Windows x86-64** column, click the download button. A file like `postgresql-16.x-x-windows-x64.exe` downloads.
3. Open it, press **Yes** when Windows asks, then go through the screens:
   1. **Setup:** press **Next**.
   2. **Installation Directory:** leave it, press **Next**.
   3. **Select Components:** keep **PostgreSQL Server**, **pgAdmin 4** and **Command Line Tools** ticked. **Untick Stack Builder** (not needed). Press **Next**.
   4. **Data Directory:** leave it, press **Next**.
   5. **Password:** this is the password of the database's main user, called `postgres`. Type it in both boxes.
      - **Use only letters and numbers** (no `@`, `:`, `/`, `#` or `%`: they cause trouble later).
      - The easiest choice is `postgres`. Then the site's settings file works without any change. This database only exists on your computer, so that's fine.
      - **Write the password down.** You'll need it twice.
   6. **Port:** leave **5432**, press **Next**.
   7. **Advanced Options (Locale):** leave **[Default locale]**, press **Next**.
   8. **Pre Installation Summary** and **Ready to Install:** press **Next**, then **Next**. Installing takes a few minutes.
   9. **Completing:** press **Finish**. (If a box offers to launch Stack Builder, untick it first.)

PostgreSQL now runs quietly in the background, and starts with Windows by itself. You never need to start it by hand.

## Part 4: Open PowerShell and check the tools

PowerShell is the window where you type commands.

1. Press the **Windows key**, type `PowerShell`, and open **Windows PowerShell**. (Not "as administrator": a normal window.)
2. **Let npm run in PowerShell** (once on this computer). Windows blocks npm's scripts by default, which gives the error "running scripts is disabled on this system". Type:

   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```

   It asks "Do you want to change the execution policy?". Type `Y` and press **Enter**. This only affects your own user account, and is Microsoft's recommended setting for developers.

3. Check each tool. Type these three, one at a time:

   ```powershell
   git --version
   node -v
   npm -v
   ```

   You should see versions, for example `git version 2.51.0.windows.1`, then `v24.11.0` (it must start with `v22` or higher), then `11.6.2`.

   If any says **"is not recognized as the name of a cmdlet"**, close PowerShell and open it again (a window opened before an install doesn't know about it). If it still isn't found, restart the computer.

## Part 5: Download the code

1. Make a folder for it, with a short path and no spaces, and go into it:

   ```powershell
   mkdir C:\dev
   cd C:\dev
   ```

   (If `mkdir` says access is denied, use your own folder instead: `cd $HOME`, then `mkdir dev`, then `cd dev`.)

2. Download the code. This exact command gets the right branch, `claude/zalfi-backend`, the one with the admin and the backend. A plain clone would give you an older branch without them:

   ```powershell
   git clone -b claude/zalfi-backend https://github.com/Treion/zalfiweb.git
   ```

   It downloads about 80 MB and ends with `Updating files: 100%`.

3. Go into the project folder:

   ```powershell
   cd zalfiweb
   ```

   **Every command from here on runs in this folder.** The PowerShell prompt shows it: `PS C:\dev\zalfiweb>`.

4. Install the site's building blocks:

   ```powershell
   npm install
   ```

   This takes 5 to 10 minutes. Many `npm warn` lines are normal, and so is a closing note about "vulnerabilities". It's done when it says `added … packages` and you see the prompt again. If it ends with `npm error`, see [When something goes wrong](#when-something-goes-wrong).

## Part 6: The settings file

The site reads its settings from a file called `.env`. The project comes with a ready-made one, `.env.example`, set up for your computer.

1. Copy it:

   ```powershell
   Copy-Item .env.example .env
   ```

2. **If your PostgreSQL password is `postgres`, you're done with this part.** Skip to Part 7.

3. **If you chose another password,** put it in the file:
   1. Open the file in Notepad:

      ```powershell
      notepad .env
      ```

   2. Near the top, find this line:

      ```
      DATABASE_URL=postgresql://postgres:postgres@localhost:5432/zalfi
      ```

   3. Replace the **second** `postgres` (between `:` and `@`) with your password. For example, with the password `Zalfi2026`:

      ```
      DATABASE_URL=postgresql://postgres:Zalfi2026@localhost:5432/zalfi
      ```

   4. Save with **Ctrl+S**, and close Notepad.

Nothing else in the file needs changing on your computer.

## Part 7: Create the database

PostgreSQL is running, but it doesn't have the shop's database yet. You'll make an empty one called `zalfi`.

1. Press the **Windows key**, type `SQL Shell`, and open **SQL Shell (psql)**. A black window opens and asks four questions, each with a default in brackets.
2. Press **Enter** four times to accept the defaults:

   ```
   Server [localhost]:
   Database [postgres]:
   Port [5432]:
   Username [postgres]:
   ```

3. At `Password for user postgres:`, type your PostgreSQL password and press **Enter**. **Nothing appears while you type**: that's normal.
4. A warning about the "console code page" may appear. Ignore it. When you see `postgres=#`, type:

   ```sql
   CREATE DATABASE zalfi;
   ```

   It answers `CREATE DATABASE`. (Don't forget the `;` at the end.)

5. Type `\q` and press **Enter** to close it.

**Another way, by mouse:** open **pgAdmin 4** from the Start menu, then:
1. Open **Servers → PostgreSQL 16** and enter your password.
2. Right-click **Databases → Create → Database…**.
3. Type `zalfi` as the name, and press **Save**.

## Part 8: Fill the database and make your admin account

Back in **PowerShell** (still in `C:\dev\zalfiweb`):

1. **Create the tables:**

   ```powershell
   npm run db:migrate
   ```

   It ends with `migrations applied successfully!`.

2. **Add the catalogue** (the six fragrances, their notes and prices, and the two discovery sets):

   ```powershell
   npm run db:seed
   ```

   It ends with a line like `Seeded { f: '6', n: '24', … s: '2' }`.

3. **Optional: demo data.** Add 90 days of made-up orders, customers and coupons, so the admin's charts and reports have something to show:

   ```powershell
   npm run db:seed:demo
   ```

   (You can remove the demo data later with `npm run db:seed:demo -- --clear`.)

4. **Make your admin account:**

   ```powershell
   npm run admin
   ```

   It shows a menu:

   ```
     1  Create an admin
     2  List admins
     3  Reset a password
     4  Switch an admin off or on

   Choose [1]:
   ```

   Then:
   1. Press **Enter** (choosing 1).
   2. **Email:** type your email and press Enter.
   3. **Name:** type your name, or press Enter to keep the suggestion.
   4. **Role:** press **Enter** to accept `owner` (the first account is always the owner).
   5. **Password:** type a password of **at least 10 characters** (each character shows as `*`), press Enter, then type it again. Or just press Enter to have a strong one made for you: it's shown once, so write it down.

   It ends with `✓ Your Name can now sign in as owner.` and your email. That's your sign-in for the admin.

## Part 9: Start the site

1. Type:

   ```powershell
   npm run dev
   ```

2. Wait for these lines:

   ```
   Starting the local database bridge on :4444
   ▲ Next.js 16.x.x
   - Local:         http://localhost:3000
   ✓ Ready in …
   ```

   **Windows may ask whether Node.js can use the network.** Press **Allow** (Private networks is enough). If you press Cancel, the site still works on this computer.

3. Open your browser at **[http://localhost:3000](http://localhost:3000)**: the shop.
   - **The first visit to each page is slow** (up to a minute or two): the site prepares each page the first time you open it. After that it's quick.
   - **Not seeing the 3D bottles?** A computer without a graphics card, or with it switched off in the browser, gets the calm, still version of the same pages. To see the 3D stage anyway, open **[http://localhost:3000/?stage=force](http://localhost:3000/?stage=force)** once (`?stage=off` undoes it).
4. Open **[http://localhost:3000/admin](http://localhost:3000/admin)** and sign in with the account from Part 8.

**Keep the PowerShell window open** while you use the site: closing it stops the site.

**To stop the site:** click in the PowerShell window and press **Ctrl+C**. If it asks `Terminate batch job (Y/N)?`, type `Y` and press Enter.

## Part 10: Try an order

Everything works on your computer with test stand-ins, so you can try the whole flow:

1. **Optional: cash on delivery.** It's off by default. Switch it on in **Admin → Settings → Payments**.
2. **Buy:** in the shop, add a bottle (or a discovery set) to the bag and press **Checkout**.
3. **Verify the phone:** your name and any Bangladeshi mobile number (`01712345678`), then **Send code**. On your computer the code appears right under the field. Type it in.
4. **Address and payment:** choose a district and area, then **Pay online** (or **Cash on delivery**), and **Place order**.
5. **Pay:** a test payment page opens. Press **Pay successfully**, and you land on the confirmation page.
6. **The receipt** that would be emailed is saved in the project folder, in `.data\outbox\` (open the `.html` file in your browser, or the PDF).
7. **In the admin**, open **Orders**, then the new order:
   1. Press **Send to courier**, then **Send**.
   2. Press **Label** to see the shipping label.
   3. Use **Courier update** to play the courier, up to **Delivered**.

[`local-setup.md`](local-setup.md#6-try-an-order-from-start-to-finish) has more on what to try.

## Every day after this

**To start the site again** (after a restart, or the next day):

1. Open **Windows PowerShell**.
2. Type:

   ```powershell
   cd C:\dev\zalfiweb
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000).

PostgreSQL starts with Windows by itself, so there's nothing else to start.

**To get the latest version of the code:** stop the site (Ctrl+C), then:

```powershell
cd C:\dev\zalfiweb
git pull
npm install
npm run dev
```

`npm run dev` applies any database changes the update brings, by itself.

**To edit the code,** a free editor like [Visual Studio Code](https://code.visualstudio.com) is easiest: **File → Open Folder → C:\dev\zalfiweb**. Its built-in terminal (**Terminal → New Terminal**) is PowerShell, already in the right folder.

**The tests** (optional):

| Command | What it checks |
|---|---|
| `npm test` | The unit tests. No database needed |
| `npm run test:db` | The database tests (stock, orders, payments…). PostgreSQL must be running |
| `npm run check` | Lint, type checks, unit tests and a production build: what to run before sharing a change |
| `npx playwright install chromium`, then `npm run test:e2e` | The browser tests. The first command is needed once on this computer: it downloads the test browser |

## When something goes wrong

**"running scripts is disabled on this system" (when typing `npm …`)**
Do Part 4, step 2: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then `Y`.

**"'git' / 'node' / 'npm' is not recognized…"**
Close PowerShell and open a new one. Still not found: restart the computer. Still not: install that program again (Part 1 or 2), keeping the default options.

**`npm install` ends with `npm error`**
- `EPERM` or `EBUSY` ("operation not permitted", "resource busy"): another program is holding a file, usually an editor or the antivirus scanning the new files. Close Visual Studio Code and other PowerShell windows, then run `npm install` again.
- `ENOTFOUND`, `ETIMEDOUT` or `ECONNRESET`: the internet connection dropped. Run `npm install` again: it continues where it stopped.
- Anything else: delete the half-installed folder and start the install over:

  ```powershell
  Remove-Item -Recurse -Force node_modules
  npm install
  ```

**`git clone` says "destination path 'zalfiweb' already exists"**
The code is already there: just `cd zalfiweb` and carry on. To start over, delete the folder first: `Remove-Item -Recurse -Force C:\dev\zalfiweb`.

**"PostgreSQL isn't running" or `ECONNREFUSED`**
PostgreSQL's service stopped. Start it:
1. Press the **Windows key**, type `Services`, and open **Services**.
2. Find **postgresql-x64-16** in the list, right-click it, and choose **Start**.
3. So it always starts with Windows: double-click it, set **Startup type** to **Automatic**, and press **OK**.

**`password authentication failed for user "postgres"`**
The password in `.env` doesn't match the one you chose when installing PostgreSQL. Fix the `DATABASE_URL` line (Part 6, step 3).

**`database "zalfi" does not exist`**
Do Part 7. Then `npm run db:migrate` and `npm run db:seed` (Part 8).

**I forgot the PostgreSQL password**
The simplest way on a computer used only for this is to reinstall PostgreSQL. **This deletes the local database** (your test orders and admin account), which Parts 7 and 8 then make again.
1. **Settings → Apps → Installed apps → PostgreSQL 16 → Uninstall.**
2. Delete the folder `C:\Program Files\PostgreSQL\16` if it's still there.
3. Do Part 3 again, choosing a password you'll remember.

**`relation "…" does not exist`**
The tables aren't created yet: `npm run db:migrate`.

**I can't sign in to the admin**
- Check your account exists: `npm run admin -- list`.
- Set a new password: `npm run admin -- reset-password you@example.com` (with your email).

**"Port 3000 is in use"**
The site is already running in another window. Close that window, or start this one on another port: `npm run dev -- -p 3001`, then open `http://localhost:3001`.

**The page stays blank, or loads for a very long time**
The first visit to each page prepares it, which can take a minute or two on a slower computer. Watch the PowerShell window: it prints `GET / 200` when the page is ready. If it shows red error text instead, read the first error line: it usually names the problem (often the database: see above).

**The checkout code never arrives**
On your computer there's no real SMS: the code appears right under the phone field, and in the PowerShell window. After 5 wrong tries, or within 60 seconds of the last code, a new one is refused: wait a minute.

**`git pull` says "Your local changes to package-lock.json would be overwritten"**
`npm install` changed that file. Undo it, then pull again:

```powershell
git checkout -- package-lock.json
git pull
npm install
```
