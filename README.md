# Atlas of Ooo

A dependency-free interactive HTML website powered by the Chardle Adventure Time database.

## Run locally

Open `index.html` directly in a browser, or serve the folder with any static server:

```sh
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

The page selects 300 records from [Fandom's Adventure Time Characters category](https://adventuretime.fandom.com/wiki/Category:Characters) through its MediaWiki API, prioritizing a curated set of important characters before filling the remaining slots from the category. Each selected character includes its thumbnail and introductory notes. Fandom categories are used to organize entries into groups such as Candy People, Humans, Princesses, Wizards, Vampires, Animals, and Creatures. Page details are requested in batches so the atlas stays manageable without bundling a large generated data file. Chardle's Adventure Time database and the previous Adventure Time API remain secondary sources, followed by offline field notes if the live sources are unavailable.

The atlas provides search, category filters, random selection, detail notes, loading states, and retry behavior.
