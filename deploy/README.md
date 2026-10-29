# Eversimmer FM op de Raspberry Pi

De pot-server draait op de Pi als systemd-service. Hij luistert alleen op `127.0.0.1:8787` en serveert de pagina en de WebSocket allebei. Een Cloudflare Tunnel brengt hem naar buiten. Je hoeft dus geen poorten open te zetten, je IP-adres blijft verborgen, en HTTPS en WebSockets werken vanzelf.

Elke tien minuten kijkt de Pi of er iets nieuws op `main` staat. Is dat zo, dan bouwt hij de nieuwe versie in een eigen map naast de draaiende versie en draait daar `npm run check`. Alleen als dat slaagt, schakelt hij over en herstart hij de server. Een versie die faalt, wordt onthouden en niet opnieuw geprobeerd tot `main` verder gaat.

```
/opt/eversimmer/
  repo/                 clone van GitHub; alleen om op te halen
  releases/<commit>/    de draaiende versie en de vorige
  current -> releases/… wat er speelt
  shared/env            je Anthropic-key en eigen instellingen
  shared/kept/          elke pot, bewaard voor een herstart
  shared/failed         de laatste versie die zijn checks niet haalde
```

## Eén keer: voorbereiden

1. **Koeling.** Zet de Pi in de case met ventilator. Controleer daarna met `vcgencmd measure_temp` (dat moet ruim onder de 70 °C blijven) en met `vcgencmd get_throttled` (dat moet `throttled=0x0` geven).
2. **Node 22 en git.** Raspbian heeft standaard een oudere Node. Installeer die van NodeSource:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs git
   node -v   # v22 of hoger
   ```
   Dit raakt BirdNET-Go niet; dat is een eigen programma.
3. **Installeren.** Kopieer `deploy/install.sh` vanaf je laptop naar de Pi en draai het script:
   ```bash
   scp deploy/install.sh birds:   # of hoe je de Pi ook bereikt
   ssh birds
   sudo bash install.sh
   ```
   De eerste keer maakt het script een *deploy key* en stopt het. Voeg die key toe op GitHub onder **Settings › Deploy keys** van de repo. Laat "Allow write access" uit. Draai het script daarna nog een keer. Het maakt dan de gebruiker `eversimmer` aan, haalt de code op, bouwt en checkt de eerste release en start de service en de update-timer.

   Het script haalt de bestanden uit `deploy/` van `main`. Merge deze branch dus eerst.
4. **De Anthropic-key.** Zet je key in `/opt/eversimmer/shared/env`:
   ```bash
   sudo nano /opt/eversimmer/shared/env
   sudo systemctl restart eversimmer
   ```
   Let op de kosten. In productie schrijft de live coder elke 5 tot 8 minuten een nieuwe course zolang er iemand in de kamer is, en draait de extractie elke minuut zolang er gechat wordt. Met `LIVE_CODER=off` in hetzelfde bestand komen er alleen courses als je erom vraagt.

## De weer-pot als launch

Voor de launch speelt alleen de weer-pot, op de voorpagina, zonder live coder. `env.example` zet dat zo:

```
POTS=weather
WEATHER_PLACE=bergen
LIVE_CODER=off
```

Een nieuwe installatie krijgt die regels vanzelf. Heb je al een `shared/env`, zet ze er dan zelf bij en herstart de service. Zonder Anthropic-key werkt de weer-pot ook: hij gebruikt geen LLM, en Open-Meteo is gratis en heeft geen key nodig.

Twee dingen om vóór de launch te beslissen:

- **Onweer.** Het standaardmodel van Open-Meteo zegt rond Bergen nooit "onweer". Met `WEATHER_MODEL=icon_seamless` wel.
- **De voorwaarden van Open-Meteo.** Gratis voor niet-commercieel gebruik, met naamsvermelding (die staat onderaan de pagina). Verdien je er iets mee, dan heb je een API-plan nodig.

## Bewaard over een herstart

De service bewaart elke pot elke 30 seconden in `shared/kept/`, en ook als hij stopt. Na een herstart, een update of een crash gaat de muziek verder waar hij was, op de cycle waar hij nu zou zijn. Wie luistert, hoort een korte herstart niet: de pagina speelt door en herverbindt. Is de stone in de update veranderd, dan neemt de stone het over. Wil je dat een pot opnieuw begint, stop dan de service, gooi zijn bestand weg en start de service weer:

```bash
sudo systemctl stop eversimmer
sudo rm /opt/eversimmer/shared/kept/weather.json
sudo systemctl start eversimmer
```

## Eén keer: de Cloudflare Tunnel

Hiervoor heb je een domein nodig dat via Cloudflare loopt. Een domein bij TransIP kan ook: zet daarvoor in TransIP de nameservers op de twee die Cloudflare je geeft bij **Add a site**.

```bash
# cloudflared voor arm64
curl -fsSLo cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared.deb

cloudflared tunnel login                          # opent een link; kies je domein
cloudflared tunnel create eversimmer             # print de tunnel-id
cloudflared tunnel route dns eversimmer radio.jouwdomein.nl

sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/<tunnel-id>.json /etc/cloudflared/
sudo cp /opt/eversimmer/current/deploy/cloudflared.yml /etc/cloudflared/config.yml
sudo nano /etc/cloudflared/config.yml             # tunnel-id en hostname invullen
sudo cloudflared service install
```

Open daarna `https://radio.jouwdomein.nl`. De dev-controls staan in productie uit.

## Dagelijks

| Wat | Hoe |
| --- | --- |
| Draait hij? | `systemctl status eversimmer` of `curl localhost:8787/health` (`up` is hoe lang al, in seconden) |
| Logs | `journalctl -u eversimmer -f` |
| Logs van updates | `journalctl -u eversimmer-update` |
| Nu updaten | `sudo systemctl start eversimmer-update` |
| Terug naar de vorige versie | `sudo /opt/eversimmer/current/deploy/rollback.sh` |
| Feedback-momenten | `/opt/eversimmer/shared/feedback.jsonl` |

## Een week onbeheerd

De laatste stap vóór de launch is een week laten draaien zonder ernaar om te kijken. Controleer daarna:

- `curl localhost:8787/health`: `up` laat zien of hij sinds de laatste update niet herstart is. `journalctl -u eversimmer | grep -c "the server broke"` telt de crashes.
- `journalctl -u eversimmer | grep "carried on"`: bij elke herstart moet de pot verder zijn gegaan.
- `journalctl -u eversimmer | grep -c "no weather from"`: hoe vaak het weer niet binnenkwam. Een paar keer per week is geen probleem; na een uur zonder weer drijft de pot terug naar rust.
- `systemctl status eversimmer` toont ook het geheugen. Blijft dat ruim onder de 768 MB?
- `vcgencmd measure_temp` en `vcgencmd get_throttled`, zoals bij het voorbereiden.
- Laat een telefoon en een laptop een paar uur meeluisteren, met de wifi even uit en het scherm even op slot.

Bij het opstarten meet de validator hoe snel de Pi de stone afspeelt, en hij schaalt zijn limieten daarnaar. In de log staat dan een regel als *"this machine plays the stone 3.4× slower than a laptop"*. Wordt dat getal veel hoger dan 5, dan heeft de Pi het te druk of is hij te warm.

## Wat de service mag

De server draait als gebruiker `eversimmer` en kan alleen in `/opt/eversimmer/shared` schrijven. Hij krijgt een lagere prioriteit dan BirdNET-Go en mag hooguit 1 GB geheugen gebruiken.

De update draait ook als `eversimmer`, niet als root. Wat er op `main` komt, wordt dus nooit als root gebouwd of uitgevoerd. Eén ding mag de update als root: de service herstarten. Dat staat in `/etc/sudoers.d/eversimmer`. `npm ci` draait zonder de install-scripts van de dependencies (`--ignore-scripts`), want die zijn hier niet nodig.

**Al eerder geïnstalleerd?** De update vernieuwt de systemd-units en de sudo-regel niet zelf. Draai na het mergen het installatiescript nog een keer. Dat kan altijd, want het script slaat over wat er al is:

```bash
sudo -u eversimmer git -C /opt/eversimmer/repo pull --quiet
sudo bash /opt/eversimmer/repo/deploy/install.sh
```

**Nog geïnstalleerd als `masterstock`?** Tot je overstapt, draait de oude installatie gewoon door en haalt hij de nieuwe versies binnen. Overstappen gaat zo, zodra de publieke repo `eversimmer` op GitHub staat:

```bash
# 1. het nieuwe script ophalen en één keer draaien: het maakt de gebruiker eversimmer en een nieuwe deploy key, en stopt
sudo -u masterstock git -C /opt/masterstock/repo pull --quiet
sudo bash /opt/masterstock/repo/deploy/install.sh
# 2. voeg de getoonde key toe op GitHub (Deploy keys) en haal de oude weg
# 3. de key, de bewaarde pots en de feedback meenemen
sudo mkdir -p /opt/eversimmer
sudo cp -a /opt/masterstock/shared /opt/eversimmer/
sudo chown -R eversimmer: /opt/eversimmer/shared
sudo chown root:eversimmer /opt/eversimmer/shared/env
# 4. de oude stoppen, de nieuwe installeren en starten
sudo systemctl disable --now masterstock.service masterstock-update.timer
sudo bash /opt/masterstock/repo/deploy/install.sh
# 5. als hij speelt en de pot verder is gegaan: de oude opruimen
sudo rm /etc/systemd/system/masterstock*.service /etc/systemd/system/masterstock-update.timer /etc/sudoers.d/masterstock
sudo systemctl daemon-reload
sudo rm -rf /opt/masterstock
sudo userdel -r masterstock
```

De Cloudflare-tunnel hoeft niet mee: zijn naam telt alleen bij het aanmaken, en hij wijst naar poort 8787.
