// À coller dans la feuille Google « GPS - MATCH » : Extensions › Apps Script (voir docs/PLAN.md, import GPS).
// Renvoie l'onglet « Données » à l'app du Pôle, et seulement à elle : la clé secrète (propriété CLE_APP du script)
// est connue du serveur de l'app, jamais du navigateur. La feuille reste privée (aucune publication web).
function doGet(e) {
  var cle = PropertiesService.getScriptProperties().getProperty('CLE_APP')
  if (!cle || !e || !e.parameter || e.parameter.cle !== cle) return json_({ erreur: 'refusé' })
  var onglet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Données')
  if (!onglet) return json_({ erreur: 'onglet « Données » introuvable' })
  return json_({ lignes: onglet.getDataRange().getValues() })
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}
