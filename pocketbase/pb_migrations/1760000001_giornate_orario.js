/// <reference path="../pb_data/types.d.ts" />
// Orario diverso per una singola giornata: due campi in più nella collezione "giornate" ("HH:MM").
// Vuoti = orario standard (lun–ven 16:30–18:30, sabato 8:30–12:30).
migrate((app) => {
  const c = app.findCollectionByNameOrId("giornate");
  c.fields.add(new TextField({ name: "inizio", max: 5 }));
  c.fields.add(new TextField({ name: "fine", max: 5 }));
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("giornate");
  c.fields.removeByName("inizio");
  c.fields.removeByName("fine");
  app.save(c);
});
