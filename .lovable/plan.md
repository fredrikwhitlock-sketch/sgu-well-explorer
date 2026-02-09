

# Exportfunktion for alla vektorlager

## Sammanfattning
Lagger till CSV-exportknappar (och rensa-knappar) for alla vektorlager i lagerpanelen, pa samma satt som brunnar redan har. Varje lager far sin egen exportfunktion som exporterar alla laddade features med relevanta attribut.

## Vad andras

### 1. Ny generisk exportfunktion (`src/lib/exportWells.ts` -> utoka)
Lagger till en generisk `exportFeaturesToCSV(features, attributes, filename)` funktion samt fordefinierade attributlistor for varje lagertyp:
- **Kallor** - attribut fran SGU kallor-API (t.ex. kallid, kallnamn, kommun, etc.)
- **Grundvattenmagasin** - attribut fran magasin-API
- **Jordarter** - attribut fran jordarter25k-API (jordartstyp, etc.)
- **Grundvattenforekomster** - attribut fran vattenforekomst-API
- **Grundvattennivaer observerade** - attribut fran nivaer-stationer
- **Grundvattenkvalitet** - attribut fran kvalitet-provplatser

Attributen lasas av fran de features som faktiskt ar laddade, sa alla egenskaper som finns i datan inkluderas.

### 2. Uppdatera LayerPanel (`src/components/Map/LayerPanel.tsx`)
For varje vektorlager (kallor, magasin, jordarter, vattenforekomster, gw-nivaer, gw-kvalitet):
- Lagg till `onExport[Layer]` och `onClear[Layer]` callback-props
- Visa exportera-knapp och rensa-knapp nar lagret ar synligt och har laddad data (samma monster som brunnar)

### 3. Uppdatera MapView (`src/components/Map/MapView.tsx`)
- Koppla export-callbacks till varje lagers VectorSource via layerRef
- Koppla clear-callbacks som rensar source och nollstaller raknare

## Tekniska detaljer

- Exportfunktionen ateranvander samma CSV-logik (semikolon-separator, UTF-8 BOM) som brunnar
- En flexibel approach: om inga fordefinierade attribut finns for ett lager, exporteras alla egenskaper fran features automatiskt
- Filnamn foljer monster: `[lagernamn]_export_[datum].csv`
- Rensa-knappen fungerar identiskt med brunnars rensa-funktion (clear source + nollstall raknare)

