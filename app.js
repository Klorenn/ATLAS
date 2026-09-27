// Bootstrap de la página suelta de Stellar Atlas.
//
// Toda la lógica vive en explorer.js como componente reutilizable; aquí solo se
// monta sobre el host de esta página. La landing monta el mismo componente con
// el tema "brand" y carga el catálogo de forma diferida.

(function bootstrapAtlasPage() {
  'use strict';

  const host = document.getElementById('root');
  const catalog = window.tellusCatalog;
  window.StellarAtlas.mount(host, catalog);
}());
