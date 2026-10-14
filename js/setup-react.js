// Puente para el código existente: los componentes escritos con
// `window.React.createElement` siguen funcionando tras pasar de React por CDN a
// React empaquetado con Vite. Este módulo se evalúa ANTES que el resto.
import * as React from "react";
import * as ReactDOMClient from "react-dom/client";
import * as ReactDOM from "react-dom";

window.React = React;
window.ReactDOM = { ...ReactDOM, ...ReactDOMClient };
