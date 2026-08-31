import {
  FlyToInterpolator,
  LinearInterpolator,
  View,
  Widget,
  applyStyles,
  deck_default,
  deepEqual,
  globe_viewport_default,
  layer_default,
  log_default,
  orthographic_view_default,
  web_mercator_viewport_default
} from "./chunk-DDTKDAT7.js";
import {
  luma
} from "./chunk-XJ335VRC.js";
import {
  require_react
} from "./chunk-TWJRYSII.js";
import {
  __toESM
} from "./chunk-DC5AMYBS.js";

// node_modules/@deck.gl/react/dist/deckgl.js
var React3 = __toESM(require_react(), 1);
var import_react6 = __toESM(require_react(), 1);

// node_modules/@deck.gl/react/dist/utils/use-isomorphic-layout-effect.js
var import_react = __toESM(require_react(), 1);
var useIsomorphicLayoutEffect = typeof window !== "undefined" ? import_react.useLayoutEffect : import_react.useEffect;
var use_isomorphic_layout_effect_default = useIsomorphicLayoutEffect;

// node_modules/@deck.gl/react/dist/utils/extract-jsx-layers.js
var React2 = __toESM(require_react(), 1);
var import_react3 = __toESM(require_react(), 1);

// node_modules/@deck.gl/react/dist/utils/inherits-from.js
function inheritsFrom(Type, ParentType) {
  while (Type) {
    if (Type === ParentType) {
      return true;
    }
    Type = Object.getPrototypeOf(Type);
  }
  return false;
}

// node_modules/@deck.gl/react/dist/utils/evaluate-children.js
var React = __toESM(require_react(), 1);
var import_react2 = __toESM(require_react(), 1);
var MAP_STYLE = { position: "absolute", zIndex: -1 };
function evaluateChildren(children, childProps) {
  if (typeof children === "function") {
    return children(childProps);
  }
  if (Array.isArray(children)) {
    return children.map((child) => evaluateChildren(child, childProps));
  }
  if (isComponent(children)) {
    if (isReactMap(children)) {
      childProps.style = MAP_STYLE;
      return (0, import_react2.cloneElement)(children, childProps);
    }
    if (needsDeckGLViewProps(children)) {
      return (0, import_react2.cloneElement)(children, childProps);
    }
  }
  return children;
}
function isComponent(child) {
  return React.isValidElement(child);
}
function isReactMap(child) {
  var _a;
  return (_a = child.props) == null ? void 0 : _a.mapStyle;
}
function needsDeckGLViewProps(child) {
  const componentClass = child.type;
  return componentClass && componentClass.deckGLViewProps;
}

// node_modules/@deck.gl/react/dist/utils/extract-jsx-layers.js
function wrapInView(node) {
  if (typeof node === "function") {
    return (0, import_react3.createElement)(View, {}, node);
  }
  if (Array.isArray(node)) {
    return node.map(wrapInView);
  }
  if (isComponent(node)) {
    if (node.type === React2.Fragment) {
      return wrapInView(node.props.children);
    }
    if (inheritsFrom(node.type, View)) {
      return node;
    }
  }
  return node;
}
function extractJSXLayers({ children, layers = [], views }) {
  const reactChildren = [];
  const jsxLayers = [];
  const jsxViews = {};
  React2.Children.forEach(wrapInView(children), (reactElement) => {
    if (isComponent(reactElement)) {
      const ElementType = reactElement.type;
      if (inheritsFrom(ElementType, layer_default)) {
        const layer = createLayer(ElementType, reactElement.props);
        jsxLayers.push(layer);
      } else {
        reactChildren.push(reactElement);
      }
      if (inheritsFrom(ElementType, View) && ElementType !== View && reactElement.props.id) {
        const view = new ElementType(reactElement.props);
        jsxViews[view.id] = view;
      }
    } else if (reactElement) {
      reactChildren.push(reactElement);
    }
  });
  if (Object.keys(jsxViews).length > 0) {
    if (Array.isArray(views)) {
      views.forEach((view) => {
        jsxViews[view.id] = view;
      });
    } else if (views) {
      jsxViews[views.id] = views;
    }
    views = Object.values(jsxViews);
  }
  layers = jsxLayers.length > 0 ? [jsxLayers, layers] : layers;
  return { layers, children: reactChildren, views };
}
function createLayer(LayerType, reactProps) {
  const props = {};
  const defaultProps = LayerType.defaultProps || {};
  for (const key in reactProps) {
    if (defaultProps[key] !== reactProps[key]) {
      props[key] = reactProps[key];
    }
  }
  return new LayerType(props);
}

// node_modules/@deck.gl/react/dist/utils/position-children-under-views.js
var import_react5 = __toESM(require_react(), 1);

// node_modules/@deck.gl/react/dist/utils/deckgl-context.js
var import_react4 = __toESM(require_react(), 1);
var DeckGlContext = (0, import_react4.createContext)();

// node_modules/@deck.gl/react/dist/utils/position-children-under-views.js
function positionChildrenUnderViews({ children, deck, ContextProvider = DeckGlContext.Provider }) {
  const { viewManager } = deck || {};
  if (!viewManager || !viewManager.views.length) {
    return [];
  }
  const views = {};
  const defaultViewId = viewManager.views[0].id;
  for (const child of children) {
    let viewId = defaultViewId;
    let viewChildren = child;
    if (isComponent(child) && inheritsFrom(child.type, View)) {
      viewId = child.props.id || defaultViewId;
      viewChildren = child.props.children;
    }
    const viewport = viewManager.getViewport(viewId);
    const viewState = viewManager.getViewState(viewId);
    if (viewport) {
      viewState.padding = viewport.padding;
      const { x: x2, y: y3, width, height } = viewport;
      viewChildren = evaluateChildren(viewChildren, {
        x: x2,
        y: y3,
        width,
        height,
        viewport,
        viewState
      });
      if (!views[viewId]) {
        views[viewId] = {
          viewport,
          children: []
        };
      }
      views[viewId].children.push(viewChildren);
    }
  }
  return Object.keys(views).map((viewId) => {
    const { viewport, children: viewChildren } = views[viewId];
    const { x: x2, y: y3, width, height } = viewport;
    const style = {
      position: "absolute",
      left: x2,
      top: y3,
      width,
      height
    };
    const key = `view-${viewId}`;
    const viewElement = (0, import_react5.createElement)("div", { key, id: key, style }, ...viewChildren);
    const contextValue = {
      deck,
      viewport,
      // @ts-expect-error accessing protected property
      container: deck.canvas.offsetParent,
      // @ts-expect-error accessing protected property
      eventManager: deck.eventManager,
      onViewStateChange: (params) => {
        params.viewId = viewId;
        deck._onViewStateChange(params);
      },
      widgets: []
    };
    const providerKey = `view-${viewId}-context`;
    return (0, import_react5.createElement)(ContextProvider, { key: providerKey, value: contextValue }, viewElement);
  });
}

// node_modules/@deck.gl/react/dist/utils/extract-styles.js
var CANVAS_ONLY_STYLES = {
  mixBlendMode: null
};
function extractStyles({ width, height, style }) {
  const containerStyle = {
    position: "absolute",
    zIndex: 0,
    left: 0,
    top: 0,
    width,
    height
  };
  const canvasStyle = {
    left: 0,
    top: 0
  };
  if (style) {
    for (const key in style) {
      if (key in CANVAS_ONLY_STYLES) {
        canvasStyle[key] = style[key];
      } else {
        containerStyle[key] = style[key];
      }
    }
  }
  return { containerStyle, canvasStyle };
}

// node_modules/@deck.gl/react/dist/deckgl.js
function getRefHandles(thisRef) {
  return {
    get deck() {
      return thisRef.deck;
    },
    // The following method can only be called after ref is available, by which point deck is defined in useEffect
    pickObjectAsync: (opts) => thisRef.deck.pickObjectAsync(opts),
    pickObjectsAsync: (opts) => thisRef.deck.pickObjectsAsync(opts),
    pickObject: (opts) => thisRef.deck.pickObject(opts),
    pickMultipleObjects: (opts) => thisRef.deck.pickMultipleObjects(opts),
    pickObjects: (opts) => thisRef.deck.pickObjects(opts)
  };
}
function redrawDeck(thisRef) {
  if (thisRef.redrawReason) {
    thisRef.deck._drawLayers(thisRef.redrawReason);
    thisRef.redrawReason = null;
  }
}
function createDeckInstance(thisRef, DeckClass, props) {
  var _a, _b, _c;
  const deck = new DeckClass({
    ...props,
    // The Deck's animation loop is independent from React's render cycle, causing potential
    // synchronization issues. We provide this custom render function to make sure that React
    // and Deck update on the same schedule.
    // TODO(ibgreen) - Hack to enable WebGPU as it needs to render quickly to avoid CanvasContext texture from going stale
    _customRender: ((_c = (_b = (_a = props.deviceProps) == null ? void 0 : _a.adapters) == null ? void 0 : _b[0]) == null ? void 0 : _c.type) === "webgpu" ? void 0 : (redrawReason) => {
      thisRef.redrawReason = redrawReason;
      const viewports = deck.getViewports();
      if (thisRef.lastRenderedViewports !== viewports) {
        thisRef.forceUpdate();
      } else {
        redrawDeck(thisRef);
      }
    }
  });
  return deck;
}
function DeckGLWithRef(props, ref) {
  const [version, setVersion] = (0, import_react6.useState)(0);
  const _thisRef = (0, import_react6.useRef)({
    control: null,
    version,
    forceUpdate: () => setVersion((v3) => v3 + 1)
  });
  const thisRef = _thisRef.current;
  const containerRef = (0, import_react6.useRef)(null);
  const canvasRef = (0, import_react6.useRef)(null);
  const jsxProps = (0, import_react6.useMemo)(() => extractJSXLayers(props), [props.layers, props.views, props.children]);
  let inRender = true;
  const handleViewStateChange = (params) => {
    var _a;
    if (inRender && props.viewState) {
      thisRef.viewStateUpdateRequested = params;
      return null;
    }
    thisRef.viewStateUpdateRequested = null;
    return (_a = props.onViewStateChange) == null ? void 0 : _a.call(props, params);
  };
  const handleInteractionStateChange = (params) => {
    var _a;
    if (inRender) {
      thisRef.interactionStateUpdateRequested = params;
    } else {
      thisRef.interactionStateUpdateRequested = null;
      (_a = props.onInteractionStateChange) == null ? void 0 : _a.call(props, params);
    }
  };
  const deckProps = (0, import_react6.useMemo)(() => {
    const forwardProps = {
      widgets: [],
      ...props,
      // Override user styling props. We will set the canvas style in render()
      style: null,
      width: "100%",
      height: "100%",
      parent: containerRef.current,
      canvas: canvasRef.current,
      layers: jsxProps.layers,
      onViewStateChange: handleViewStateChange,
      onInteractionStateChange: handleInteractionStateChange
    };
    if (jsxProps.views) {
      forwardProps.views = jsxProps.views;
    }
    delete forwardProps._customRender;
    if (thisRef.deck) {
      thisRef.deck.setProps(forwardProps);
      if (thisRef.deck.isInitialized) {
        thisRef.lastRenderedViewports = thisRef.deck.getViewports();
      }
    }
    return forwardProps;
  }, [props]);
  (0, import_react6.useEffect)(() => {
    const DeckClass = props.Deck || deck_default;
    thisRef.deck = createDeckInstance(thisRef, DeckClass, {
      ...deckProps,
      parent: containerRef.current,
      canvas: canvasRef.current
    });
    return () => {
      var _a;
      return (_a = thisRef.deck) == null ? void 0 : _a.finalize();
    };
  }, []);
  use_isomorphic_layout_effect_default(() => {
    redrawDeck(thisRef);
    const { viewStateUpdateRequested, interactionStateUpdateRequested } = thisRef;
    if (viewStateUpdateRequested) {
      handleViewStateChange(viewStateUpdateRequested);
    }
    if (interactionStateUpdateRequested) {
      handleInteractionStateChange(interactionStateUpdateRequested);
    }
  });
  (0, import_react6.useImperativeHandle)(ref, () => getRefHandles(thisRef), []);
  const currentViewports = thisRef.deck && thisRef.deck.isInitialized ? thisRef.deck.getViewports() : void 0;
  const { ContextProvider, width = "100%", height = "100%", id, style } = props;
  const { containerStyle, canvasStyle } = (0, import_react6.useMemo)(() => extractStyles({ width, height, style }), [width, height, style]);
  if (!thisRef.viewStateUpdateRequested && thisRef.lastRenderedViewports === currentViewports || // case 2
  thisRef.version !== version) {
    thisRef.lastRenderedViewports = currentViewports;
    thisRef.version = version;
    const childrenUnderViews = positionChildrenUnderViews({
      children: jsxProps.children,
      deck: thisRef.deck,
      ContextProvider
    });
    const canvas = (0, import_react6.createElement)("canvas", {
      key: "canvas",
      id: id || "deckgl-overlay",
      ref: canvasRef,
      style: canvasStyle
    });
    const eventRoot = (0, import_react6.createElement)("div", {
      key: "deck-events-root",
      className: "deck-events-root",
      style: { width, height }
    }, [canvas, childrenUnderViews]);
    const widgetRoot = (0, import_react6.createElement)("div", {
      key: "deck-widgets-root",
      className: "deck-widgets-root"
    });
    thisRef.control = (0, import_react6.createElement)("div", { id: `${id || "deckgl"}-wrapper`, ref: containerRef, style: containerStyle }, [eventRoot, widgetRoot]);
  }
  inRender = false;
  return thisRef.control;
}
var DeckGL = React3.forwardRef(DeckGLWithRef);
var deckgl_default = DeckGL;

// node_modules/preact/dist/preact.module.js
var n;
var l;
var u;
var t;
var i;
var r;
var o;
var e;
var f;
var c;
var a;
var s;
var h;
var p;
var v;
var y;
var d = {};
var w = [];
var _ = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
var g = Array.isArray;
function m(n2, l3) {
  for (var u4 in l3) n2[u4] = l3[u4];
  return n2;
}
function b(n2) {
  n2 && n2.parentNode && n2.parentNode.removeChild(n2);
}
function k(l3, u4, t3) {
  var i4, r3, o3, e3 = {};
  for (o3 in u4) "key" == o3 ? i4 = u4[o3] : "ref" == o3 ? r3 = u4[o3] : e3[o3] = u4[o3];
  if (arguments.length > 2 && (e3.children = arguments.length > 3 ? n.call(arguments, 2) : t3), "function" == typeof l3 && null != l3.defaultProps) for (o3 in l3.defaultProps) void 0 === e3[o3] && (e3[o3] = l3.defaultProps[o3]);
  return x(l3, e3, i4, r3, null);
}
function x(n2, t3, i4, r3, o3) {
  var e3 = { type: n2, props: t3, key: i4, ref: r3, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: null == o3 ? ++u : o3, __i: -1, __u: 0 };
  return null == o3 && null != l.vnode && l.vnode(e3), e3;
}
function S(n2) {
  return n2.children;
}
function C(n2, l3) {
  this.props = n2, this.context = l3;
}
function $(n2, l3) {
  if (null == l3) return n2.__ ? $(n2.__, n2.__i + 1) : null;
  for (var u4; l3 < n2.__k.length; l3++) if (null != (u4 = n2.__k[l3]) && null != u4.__e) return u4.__e;
  return "function" == typeof n2.type ? $(n2) : null;
}
function I(n2) {
  if (n2.__P && n2.__d) {
    var u4 = n2.__v, t3 = u4.__e, i4 = [], r3 = [], o3 = m({}, u4);
    o3.__v = u4.__v + 1, l.vnode && l.vnode(o3), q(n2.__P, o3, u4, n2.__n, n2.__P.namespaceURI, 32 & u4.__u ? [t3] : null, i4, null == t3 ? $(u4) : t3, !!(32 & u4.__u), r3), o3.__v = u4.__v, o3.__.__k[o3.__i] = o3, D(i4, o3, r3), u4.__e = u4.__ = null, o3.__e != t3 && P(o3);
  }
}
function P(n2) {
  if (null != (n2 = n2.__) && null != n2.__c) return n2.__e = n2.__c.base = null, n2.__k.some(function(l3) {
    if (null != l3 && null != l3.__e) return n2.__e = n2.__c.base = l3.__e;
  }), P(n2);
}
function A(n2) {
  (!n2.__d && (n2.__d = true) && i.push(n2) && !H.__r++ || r != l.debounceRendering) && ((r = l.debounceRendering) || o)(H);
}
function H() {
  try {
    for (var n2, l3 = 1; i.length; ) i.length > l3 && i.sort(e), n2 = i.shift(), l3 = i.length, I(n2);
  } finally {
    i.length = H.__r = 0;
  }
}
function L(n2, l3, u4, t3, i4, r3, o3, e3, f4, c3, a3) {
  var s3, h3, p3, v3, y3, _3, g2 = t3 && t3.__k || w, m3 = l3.length;
  for (f4 = T(u4, l3, g2, f4, m3), s3 = 0; s3 < m3; s3++) null != (p3 = u4.__k[s3]) && (h3 = -1 != p3.__i && g2[p3.__i] || d, p3.__i = s3, _3 = q(n2, p3, h3, i4, r3, o3, e3, f4, c3, a3), v3 = p3.__e, p3.ref && h3.ref != p3.ref && (h3.ref && J(h3.ref, null, p3), a3.push(p3.ref, p3.__c || v3, p3)), null == y3 && null != v3 && (y3 = v3), 4 & p3.__u ? (f4 = j(p3, f4, n2), h3.__e && (h3.__e = null)) : "function" == typeof p3.type && void 0 !== _3 ? f4 = _3 : v3 && (f4 = v3.nextSibling), p3.__u &= -7);
  return u4.__e = y3, f4;
}
function T(n2, l3, u4, t3, i4) {
  var r3, o3, e3, f4, c3, a3 = u4.length, s3 = a3, h3 = 0;
  for (n2.__k = new Array(i4), r3 = 0; r3 < i4; r3++) null != (o3 = l3[r3]) && "boolean" != typeof o3 && "function" != typeof o3 ? ("string" == typeof o3 || "number" == typeof o3 || "bigint" == typeof o3 || o3.constructor == String ? o3 = n2.__k[r3] = x(null, o3, null, null, null) : g(o3) ? o3 = n2.__k[r3] = x(S, { children: o3 }, null, null, null) : void 0 === o3.constructor && o3.__b > 0 ? o3 = n2.__k[r3] = x(o3.type, o3.props, o3.key, o3.ref ? o3.ref : null, o3.__v) : n2.__k[r3] = o3, f4 = r3 + h3, o3.__ = n2, o3.__b = n2.__b + 1, e3 = null, -1 != (c3 = o3.__i = O(o3, u4, f4, s3)) && (s3--, (e3 = u4[c3]) && (e3.__u |= 2)), null == e3 || null == e3.__v ? (-1 == c3 && (i4 > a3 ? h3-- : i4 < a3 && h3++), "function" != typeof o3.type && (o3.__u |= 4)) : c3 != f4 && (c3 == f4 - 1 ? h3-- : c3 == f4 + 1 ? h3++ : (c3 > f4 ? h3-- : h3++, o3.__u |= 4))) : n2.__k[r3] = null;
  if (s3) for (r3 = 0; r3 < a3; r3++) null != (e3 = u4[r3]) && 0 == (2 & e3.__u) && (e3.__e == t3 && (t3 = $(e3)), K(e3, e3));
  return t3;
}
function j(n2, l3, u4) {
  var t3, i4;
  if ("function" == typeof n2.type) {
    for (t3 = n2.__k, i4 = 0; t3 && i4 < t3.length; i4++) t3[i4] && (t3[i4].__ = n2, l3 = j(t3[i4], l3, u4));
    return l3;
  }
  n2.__e != l3 && (l3 && n2.type && !l3.parentNode && (l3 = $(n2)), l3 = u4.insertBefore(n2.__e, l3 || null));
  do {
    l3 = l3 && l3.nextSibling;
  } while (null != l3 && 8 == l3.nodeType);
  return l3;
}
function O(n2, l3, u4, t3) {
  var i4, r3, o3, e3 = n2.key, f4 = n2.type, c3 = l3[u4], a3 = null != c3 && 0 == (2 & c3.__u);
  if (null === c3 && null == e3 || a3 && e3 == c3.key && f4 == c3.type) return u4;
  if (t3 > (a3 ? 1 : 0)) {
    for (i4 = u4 - 1, r3 = u4 + 1; i4 >= 0 || r3 < l3.length; ) if (null != (c3 = l3[o3 = i4 >= 0 ? i4-- : r3++]) && 0 == (2 & c3.__u) && e3 == c3.key && f4 == c3.type) return o3;
  }
  return -1;
}
function z(n2, l3, u4) {
  "-" == l3[0] ? n2.setProperty(l3, null == u4 ? "" : u4) : n2[l3] = null == u4 ? "" : "number" != typeof u4 || _.test(l3) ? u4 : u4 + "px";
}
function N(n2, l3, u4, t3, i4) {
  var r3, o3;
  n: if ("style" == l3) if ("string" == typeof u4) n2.style.cssText = u4;
  else {
    if ("string" == typeof t3 && (n2.style.cssText = t3 = ""), t3) for (l3 in t3) u4 && l3 in u4 || z(n2.style, l3, "");
    if (u4) for (l3 in u4) t3 && u4[l3] == t3[l3] || z(n2.style, l3, u4[l3]);
  }
  else if ("o" == l3[0] && "n" == l3[1]) r3 = l3 != (l3 = l3.replace(s, "$1")), o3 = l3.toLowerCase(), l3 = o3 in n2 || "onFocusOut" == l3 || "onFocusIn" == l3 ? o3.slice(2) : l3.slice(2), n2.l || (n2.l = {}), n2.l[l3 + r3] = u4, u4 ? t3 ? u4[a] = t3[a] : (u4[a] = h, n2.addEventListener(l3, r3 ? v : p, r3)) : n2.removeEventListener(l3, r3 ? v : p, r3);
  else {
    if ("http://www.w3.org/2000/svg" == i4) l3 = l3.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
    else if ("width" != l3 && "height" != l3 && "href" != l3 && "list" != l3 && "form" != l3 && "tabIndex" != l3 && "download" != l3 && "rowSpan" != l3 && "colSpan" != l3 && "role" != l3 && "popover" != l3 && l3 in n2) try {
      n2[l3] = null == u4 ? "" : u4;
      break n;
    } catch (n3) {
    }
    "function" == typeof u4 || (null == u4 || false === u4 && "-" != l3[4] ? n2.removeAttribute(l3) : n2.setAttribute(l3, "popover" == l3 && 1 == u4 ? "" : u4));
  }
}
function V(n2) {
  return function(u4) {
    if (this.l) {
      var t3 = this.l[u4.type + n2];
      if (null == u4[c]) u4[c] = h++;
      else if (u4[c] < t3[a]) return;
      return t3(l.event ? l.event(u4) : u4);
    }
  };
}
function q(n2, u4, t3, i4, r3, o3, e3, f4, c3, a3) {
  var s3, h3, p3, v3, y3, d3, _3, k3, x2, M, I2, P2, A3, H2, T3, j3, F = u4.type;
  if (void 0 !== u4.constructor) return null;
  128 & t3.__u && (c3 = !!(32 & t3.__u), o3 = [f4 = u4.__e = t3.__e]), (s3 = l.__b) && s3(u4);
  n: if ("function" == typeof F) {
    h3 = e3.length;
    try {
      if (x2 = u4.props, M = F.prototype && F.prototype.render, I2 = (s3 = F.contextType) && i4[s3.__c], P2 = s3 ? I2 ? I2.props.value : s3.__ : i4, t3.__c ? k3 = (p3 = u4.__c = t3.__c).__ = p3.__E : (M ? u4.__c = p3 = new F(x2, P2) : (u4.__c = p3 = new C(x2, P2), p3.constructor = F, p3.render = Q), I2 && I2.sub(p3), p3.state || (p3.state = {}), p3.__n = i4, v3 = p3.__d = true, p3.__h = [], p3._sb = []), M && null == p3.__s && (p3.__s = p3.state), M && null != F.getDerivedStateFromProps && (p3.__s == p3.state && (p3.__s = m({}, p3.__s)), m(p3.__s, F.getDerivedStateFromProps(x2, p3.__s))), y3 = p3.props, d3 = p3.state, p3.__v = u4, v3) M && null == F.getDerivedStateFromProps && null != p3.componentWillMount && p3.componentWillMount(), M && null != p3.componentDidMount && p3.__h.push(p3.componentDidMount);
      else {
        if (M && null == F.getDerivedStateFromProps && x2 !== y3 && null != p3.componentWillReceiveProps && p3.componentWillReceiveProps(x2, P2), u4.__v == t3.__v || !p3.__e && null != p3.shouldComponentUpdate && false === p3.shouldComponentUpdate(x2, p3.__s, P2)) {
          u4.__v != t3.__v && (p3.props = x2, p3.state = p3.__s, p3.__d = false), u4.__e = t3.__e, u4.__k = t3.__k, u4.__k.some(function(n3) {
            n3 && (n3.__ = u4);
          }), w.push.apply(p3.__h, p3._sb), p3._sb = [], p3.__h.length && e3.push(p3), f4 = $(t3);
          break n;
        }
        null != p3.componentWillUpdate && p3.componentWillUpdate(x2, p3.__s, P2), M && null != p3.componentDidUpdate && p3.__h.push(function() {
          p3.componentDidUpdate(y3, d3, _3);
        });
      }
      if (p3.context = P2, p3.props = x2, p3.__P = n2, p3.__e = false, A3 = l.__r, H2 = 0, M) p3.state = p3.__s, p3.__d = false, A3 && A3(u4), s3 = p3.render(p3.props, p3.state, p3.context), w.push.apply(p3.__h, p3._sb), p3._sb = [];
      else do {
        p3.__d = false, A3 && A3(u4), s3 = p3.render(p3.props, p3.state, p3.context), p3.state = p3.__s;
      } while (p3.__d && ++H2 < 25);
      p3.state = p3.__s, null != p3.getChildContext && (i4 = m(m({}, i4), p3.getChildContext())), M && !v3 && null != p3.getSnapshotBeforeUpdate && (_3 = p3.getSnapshotBeforeUpdate(y3, d3)), T3 = null != s3 && s3.type === S && null == s3.key ? E(s3.props.children) : s3, f4 = L(n2, g(T3) ? T3 : [T3], u4, t3, i4, r3, o3, e3, f4, c3, a3), p3.base = u4.__e, u4.__u &= -161, p3.__h.length && e3.push(p3), k3 && (p3.__E = p3.__ = null);
    } catch (n3) {
      if (e3.length = h3, u4.__v = null, c3 || null != o3) {
        if (n3.then) {
          for (u4.__u |= c3 ? 160 : 128; f4 && 8 == f4.nodeType && f4.nextSibling; ) f4 = f4.nextSibling;
          null != o3 && (o3[o3.indexOf(f4)] = null), u4.__e = f4;
        } else if (null != o3) for (j3 = o3.length; j3--; ) b(o3[j3]);
      } else u4.__e = t3.__e;
      null == u4.__k && (u4.__k = t3.__k || []), n3.then || B(u4), l.__e(n3, u4, t3);
    }
  } else null == o3 && u4.__v == t3.__v ? (u4.__k = t3.__k, u4.__e = t3.__e) : f4 = u4.__e = G(t3.__e, u4, t3, i4, r3, o3, e3, c3, a3);
  return (s3 = l.diffed) && s3(u4), 128 & u4.__u ? void 0 : f4;
}
function B(n2) {
  n2 && (n2.__c && (n2.__c.__e = true), n2.__k && n2.__k.some(B));
}
function D(n2, u4, t3) {
  for (var i4 = 0; i4 < t3.length; i4++) J(t3[i4], t3[++i4], t3[++i4]);
  l.__c && l.__c(u4, n2), n2.some(function(u5) {
    try {
      n2 = u5.__h, u5.__h = [], n2.some(function(n3) {
        n3.call(u5);
      });
    } catch (n3) {
      l.__e(n3, u5.__v);
    }
  });
}
function E(n2) {
  return "object" != typeof n2 || null == n2 || n2.__b > 0 ? n2 : g(n2) ? n2.map(E) : void 0 !== n2.constructor ? null : m({}, n2);
}
function G(u4, t3, i4, r3, o3, e3, f4, c3, a3) {
  var s3, h3, p3, v3, y3, w3, _3, m3 = i4.props || d, k3 = t3.props, x2 = t3.type;
  if ("svg" == x2 ? o3 = "http://www.w3.org/2000/svg" : "math" == x2 ? o3 = "http://www.w3.org/1998/Math/MathML" : o3 || (o3 = "http://www.w3.org/1999/xhtml"), null != e3) {
    for (s3 = 0; s3 < e3.length; s3++) if ((y3 = e3[s3]) && "setAttribute" in y3 == !!x2 && (x2 ? y3.localName == x2 : 3 == y3.nodeType)) {
      u4 = y3, e3[s3] = null;
      break;
    }
  }
  if (null == u4) {
    if (null == x2) return document.createTextNode(k3);
    u4 = document.createElementNS(o3, x2, k3.is && k3), c3 && (l.__m && l.__m(t3, e3), c3 = false), e3 = null;
  }
  if (null == x2) m3 === k3 || c3 && u4.data == k3 || (u4.data = k3);
  else {
    if (e3 = "textarea" == x2 && null != k3.defaultValue ? null : e3 && n.call(u4.childNodes), !c3 && null != e3) for (m3 = {}, s3 = 0; s3 < u4.attributes.length; s3++) m3[(y3 = u4.attributes[s3]).name] = y3.value;
    for (s3 in m3) y3 = m3[s3], "dangerouslySetInnerHTML" == s3 ? p3 = y3 : "children" == s3 || s3 in k3 || "value" == s3 && "defaultValue" in k3 || "checked" == s3 && "defaultChecked" in k3 || N(u4, s3, null, y3, o3);
    for (s3 in k3) y3 = k3[s3], "children" == s3 ? v3 = y3 : "dangerouslySetInnerHTML" == s3 ? h3 = y3 : "value" == s3 ? w3 = y3 : "checked" == s3 ? _3 = y3 : c3 && "function" != typeof y3 || m3[s3] === y3 || N(u4, s3, y3, m3[s3], o3);
    if (h3) c3 || p3 && (h3.__html == p3.__html || h3.__html == u4.innerHTML) || (u4.innerHTML = h3.__html), t3.__k = [];
    else if (p3 && (u4.innerHTML = ""), L("template" == t3.type ? u4.content : u4, g(v3) ? v3 : [v3], t3, i4, r3, "foreignObject" == x2 ? "http://www.w3.org/1999/xhtml" : o3, e3, f4, e3 ? e3[0] : i4.__k && $(i4, 0), c3, a3), null != e3) for (s3 = e3.length; s3--; ) b(e3[s3]);
    c3 && "textarea" != x2 || (s3 = "value", "progress" == x2 && null == w3 ? u4.removeAttribute("value") : null != w3 && (w3 !== u4[s3] || "progress" == x2 && !w3 || "option" == x2 && w3 != m3[s3]) && N(u4, s3, w3, m3[s3], o3), s3 = "checked", null != _3 && _3 != u4[s3] && N(u4, s3, _3, m3[s3], o3));
  }
  return u4;
}
function J(n2, u4, t3) {
  try {
    if ("function" == typeof n2) {
      var i4 = "function" == typeof n2.__u;
      i4 && n2.__u(), i4 && null == u4 || (n2.__u = n2(u4));
    } else n2.current = u4;
  } catch (n3) {
    l.__e(n3, t3);
  }
}
function K(n2, u4, t3) {
  var i4, r3;
  if (l.unmount && l.unmount(n2), (i4 = n2.ref) && (i4.current && i4.current != n2.__e || J(i4, null, u4)), null != (i4 = n2.__c)) {
    if (i4.componentWillUnmount) try {
      i4.componentWillUnmount();
    } catch (n3) {
      l.__e(n3, u4);
    }
    i4.base = i4.__P = i4.__n = null;
  }
  if (i4 = n2.__k) for (r3 = 0; r3 < i4.length; r3++) i4[r3] && K(i4[r3], u4, t3 || "function" != typeof n2.type);
  t3 || b(n2.__e), n2.__c = n2.__ = n2.__e = void 0;
}
function Q(n2, l3, u4) {
  return this.constructor(n2, u4);
}
function R(u4, t3, i4) {
  var r3, o3, e3, f4;
  t3 == document && (t3 = document.documentElement), l.__ && l.__(u4, t3), o3 = (r3 = "function" == typeof i4) ? null : i4 && i4.__k || t3.__k, e3 = [], f4 = [], q(t3, u4 = (!r3 && i4 || t3).__k = k(S, null, [u4]), o3 || d, d, t3.namespaceURI, !r3 && i4 ? [i4] : o3 ? null : t3.firstChild ? n.call(t3.childNodes) : null, e3, !r3 && i4 ? i4 : o3 ? o3.__e : t3.firstChild, r3, f4), D(e3, u4, f4), u4.props.children = null;
}
n = w.slice, l = { __e: function(n2, l3, u4, t3) {
  for (var i4, r3, o3; l3 = l3.__; ) if ((i4 = l3.__c) && !i4.__) try {
    if ((r3 = i4.constructor) && null != r3.getDerivedStateFromError && (i4.setState(r3.getDerivedStateFromError(n2)), o3 = i4.__d), null != i4.componentDidCatch && (i4.componentDidCatch(n2, t3 || {}), o3 = i4.__d), o3) return i4.__E = i4;
  } catch (l4) {
    n2 = l4;
  }
  throw n2;
} }, u = 0, t = function(n2) {
  return null != n2 && void 0 === n2.constructor;
}, C.prototype.setState = function(n2, l3) {
  var u4;
  u4 = null != this.__s && this.__s != this.state ? this.__s : this.__s = m({}, this.state), "function" == typeof n2 && (n2 = n2(m({}, u4), this.props)), n2 && m(u4, n2), null != n2 && this.__v && (l3 && this._sb.push(l3), A(this));
}, C.prototype.forceUpdate = function(n2) {
  this.__v && (this.__e = true, n2 && this.__h.push(n2), A(this));
}, C.prototype.render = S, i = [], o = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, e = function(n2, l3) {
  return n2.__v.__b - l3.__v.__b;
}, H.__r = 0, f = Math.random().toString(8), c = "__d" + f, a = "__a" + f, s = /(PointerCapture)$|Capture$/i, h = 0, p = V(false), v = V(true), y = 0;

// node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js
var f2 = 0;
var i2 = Array.isArray;
function u2(e3, t3, n2, o3, i4, u4) {
  t3 || (t3 = {});
  var a3, c3, p3 = t3;
  if ("ref" in p3) for (c3 in p3 = {}, t3) "ref" == c3 ? a3 = t3[c3] : p3[c3] = t3[c3];
  var l3 = { type: e3, props: p3, key: n2, ref: a3, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: --f2, __i: -1, __u: 0, __source: i4, __self: u4 };
  if ("function" == typeof e3 && (a3 = e3.defaultProps)) for (c3 in a3) void 0 === p3[c3] && (p3[c3] = a3[c3]);
  return l.vnode && l.vnode(l3), l3;
}

// node_modules/@deck.gl/widgets/dist/lib/components/button-group.js
var ButtonGroup = (props) => {
  const { children, orientation = "horizontal" } = props;
  return u2("div", { className: `deck-widget-button-group ${orientation}`, children });
};

// node_modules/preact/hooks/dist/hooks.module.js
var t2;
var r2;
var u3;
var i3;
var o2 = 0;
var f3 = [];
var c2 = l;
var e2 = c2.__b;
var a2 = c2.__r;
var v2 = c2.diffed;
var l2 = c2.__c;
var m2 = c2.unmount;
var p2 = c2.__;
function s2(n2, t3) {
  c2.__h && c2.__h(r2, n2, o2 || t3), o2 = 0;
  var u4 = r2.__H || (r2.__H = { __: [], __h: [] });
  return n2 >= u4.__.length && u4.__.push({}), u4.__[n2];
}
function d2(n2) {
  return o2 = 1, y2(D2, n2);
}
function y2(n2, u4, i4) {
  var o3 = s2(t2++, 2);
  if (o3.t = n2, !o3.__c && (o3.__ = [i4 ? i4(u4) : D2(void 0, u4), function(n3) {
    var t3 = o3.__N ? o3.__N[0] : o3.__[0], r3 = o3.t(t3, n3);
    t3 !== r3 && (o3.__N = [r3, o3.__[1]], o3.__c.setState({}));
  }], o3.__c = r2, !r2.__f)) {
    var f4 = function(n3, t3, r3) {
      if (!o3.__c.__H) return true;
      var u5 = false, i5 = o3.__c.props !== n3;
      if (o3.__c.__H.__.some(function(n4) {
        if (n4.__N) {
          u5 = true;
          var t4 = n4.__[0];
          n4.__ = n4.__N, n4.__N = void 0, t4 !== n4.__[0] && (i5 = true);
        }
      }), c3) {
        var f5 = c3.call(this, n3, t3, r3);
        return u5 ? f5 || i5 : f5;
      }
      return !u5 || i5;
    };
    r2.__f = true;
    var c3 = r2.shouldComponentUpdate, e3 = r2.componentWillUpdate;
    r2.componentWillUpdate = function(n3, t3, r3) {
      if (this.__e) {
        var u5 = c3;
        c3 = void 0, f4(n3, t3, r3), c3 = u5;
      }
      e3 && e3.call(this, n3, t3, r3);
    }, r2.shouldComponentUpdate = f4;
  }
  return o3.__N || o3.__;
}
function h2(n2, u4) {
  var i4 = s2(t2++, 3);
  !c2.__s && C2(i4.__H, u4) && (i4.__ = n2, i4.u = u4, r2.__H.__h.push(i4));
}
function _2(n2, u4) {
  var i4 = s2(t2++, 4);
  !c2.__s && C2(i4.__H, u4) && (i4.__ = n2, i4.u = u4, r2.__h.push(i4));
}
function A2(n2) {
  return o2 = 5, T2(function() {
    return { current: n2 };
  }, []);
}
function T2(n2, r3) {
  var u4 = s2(t2++, 7);
  return C2(u4.__H, r3) && (u4.__ = n2(), u4.__H = r3, u4.__h = n2), u4.__;
}
function q2(n2, t3) {
  return o2 = 8, T2(function() {
    return n2;
  }, t3);
}
function j2() {
  for (var n2; n2 = f3.shift(); ) {
    var t3 = n2.__H;
    if (n2.__P && t3) try {
      t3.__h.some(z2), t3.__h.some(B2), t3.__h = [];
    } catch (r3) {
      t3.__h = [], c2.__e(r3, n2.__v);
    }
  }
}
c2.__b = function(n2) {
  r2 = null, e2 && e2(n2);
}, c2.__ = function(n2, t3) {
  n2 && t3.__k && t3.__k.__m && (n2.__m = t3.__k.__m), p2 && p2(n2, t3);
}, c2.__r = function(n2) {
  a2 && a2(n2), t2 = 0;
  var i4 = (r2 = n2.__c).__H;
  i4 && (u3 === r2 ? (i4.__h = [], r2.__h = [], i4.__.some(function(n3) {
    n3.__N && (n3.__ = n3.__N), n3.u = n3.__N = void 0;
  })) : (i4.__h.some(z2), i4.__h.some(B2), i4.__h = [], t2 = 0)), u3 = r2;
}, c2.diffed = function(n2) {
  v2 && v2(n2);
  var t3 = n2.__c;
  t3 && t3.__H && (t3.__H.__h.length && (1 !== f3.push(t3) && i3 === c2.requestAnimationFrame || ((i3 = c2.requestAnimationFrame) || w2)(j2)), t3.__H.__.some(function(n3) {
    n3.u && (n3.__H = n3.u, n3.u = void 0);
  })), u3 = r2 = null;
}, c2.__c = function(n2, t3) {
  t3.some(function(n3) {
    try {
      n3.__h.some(z2), n3.__h = n3.__h.filter(function(n4) {
        return !n4.__ || B2(n4);
      });
    } catch (r3) {
      t3.some(function(n4) {
        n4.__h && (n4.__h = []);
      }), t3 = [], c2.__e(r3, n3.__v);
    }
  }), l2 && l2(n2, t3);
}, c2.unmount = function(n2) {
  m2 && m2(n2);
  var t3, r3 = n2.__c;
  r3 && r3.__H && (r3.__H.__.some(function(n3) {
    try {
      z2(n3);
    } catch (n4) {
      t3 = n4;
    }
  }), r3.__H = void 0, t3 && c2.__e(t3, r3.__v));
};
var k2 = "function" == typeof requestAnimationFrame;
function w2(n2) {
  var t3, r3 = function() {
    clearTimeout(u4), k2 && cancelAnimationFrame(t3), setTimeout(n2);
  }, u4 = setTimeout(r3, 35);
  k2 && (t3 = requestAnimationFrame(r3));
}
function z2(n2) {
  var t3 = r2, u4 = n2.__c;
  "function" == typeof u4 && (n2.__c = void 0, u4()), r2 = t3;
}
function B2(n2) {
  var t3 = r2;
  n2.__c = n2.__(), r2 = t3;
}
function C2(n2, t3) {
  return !n2 || n2.length !== t3.length || t3.some(function(t4, r3) {
    return t4 !== n2[r3];
  });
}
function D2(n2, t3) {
  return "function" == typeof t3 ? t3(n2) : t3;
}

// node_modules/@deck.gl/widgets/dist/lib/data-url.js
function getCSSMask(imageUrl) {
  if (!imageUrl)
    return void 0;
  const cssUrl = `url("${imageUrl.replace(/"/g, `'`)}")`;
  return { maskImage: cssUrl, WebkitMaskImage: cssUrl };
}

// node_modules/@deck.gl/widgets/dist/lib/components/icon-button.js
var IconButton = (props) => {
  const { className = "", style, color, icon, label, onClick, children } = props;
  const iconStyle = T2(() => {
    const css = getCSSMask(icon);
    if (!color)
      return css;
    return { ...css, backgroundColor: color };
  }, [color, icon]);
  return u2("div", { className: "deck-widget-button", style, children: u2("button", { className: `deck-widget-icon-button ${className}`, type: "button", onClick, title: label, children: children ? children : u2("div", { className: "deck-widget-icon", style: iconStyle }) }) });
};

// node_modules/@deck.gl/widgets/dist/zoom-widget.js
var ZoomWidget = class extends Widget {
  constructor(props = {}) {
    super(props);
    this.className = "deck-widget-zoom";
    this.placement = "top-left";
    this.setProps(this.props);
  }
  setProps(props) {
    this.placement = props.placement ?? this.placement;
    this.viewId = props.viewId ?? this.viewId;
    super.setProps(props);
  }
  onRenderHTML(rootElement) {
    const ui = u2(ButtonGroup, { orientation: this.props.orientation, children: [u2(IconButton, { onClick: () => this.handleZoomIn(), label: this.props.zoomInLabel, className: "deck-widget-zoom-in" }), u2(IconButton, { onClick: () => this.handleZoomOut(), label: this.props.zoomOutLabel, className: "deck-widget-zoom-out" })] });
    R(ui, rootElement);
  }
  isOrthographicView(viewId) {
    const deck = this.deck;
    const view = (deck == null ? void 0 : deck.isInitialized) && deck.getView(viewId);
    return view instanceof orthographic_view_default;
  }
  handleZoom(viewId, delta) {
    var _a, _b, _c, _d;
    const viewState = this.getViewState(viewId);
    const newViewState = {};
    if (this.isOrthographicView(viewId)) {
      const { zoomAxis } = this.props;
      const { zoomX, minZoomX, maxZoomX, zoomY, minZoomY, maxZoomY } = normalizeOrthographicViewState(viewState);
      let nextZoom;
      let nextZoomY;
      if (zoomAxis === "X") {
        nextZoom = clamp(zoomX + delta, minZoomX, maxZoomX);
        nextZoomY = zoomY;
      } else if (zoomAxis === "Y") {
        nextZoom = zoomX;
        nextZoomY = clamp(zoomY + delta, minZoomY, maxZoomY);
      } else {
        const clampedDelta = clamp(delta, Math.max(minZoomX - zoomX, minZoomY - zoomY), Math.min(maxZoomX - zoomX, maxZoomY - zoomY));
        nextZoom = zoomX + clampedDelta;
        nextZoomY = zoomY + clampedDelta;
      }
      newViewState.zoom = [nextZoom, nextZoomY];
      newViewState.zoomX = nextZoom;
      newViewState.zoomY = nextZoomY;
      (_b = (_a = this.props).onZoom) == null ? void 0 : _b.call(_a, {
        viewId,
        delta,
        // `zoom` will not match the new state if using 2D zoom. Deprecated behavior for backward compatibility.
        zoom: zoomAxis === "Y" ? nextZoomY : nextZoom,
        zoomX: nextZoom,
        zoomY: nextZoomY
      });
    } else {
      const { zoom = 0, minZoom, maxZoom } = viewState;
      const nextZoom = clamp(zoom + delta, minZoom, maxZoom);
      newViewState.zoom = nextZoom;
      (_d = (_c = this.props).onZoom) == null ? void 0 : _d.call(_c, {
        viewId,
        delta,
        zoom: nextZoom
      });
    }
    const nextViewState = {
      ...viewState,
      ...newViewState
    };
    if (this.props.transitionDuration > 0) {
      nextViewState.transitionDuration = this.props.transitionDuration;
      nextViewState.transitionInterpolator = "latitude" in nextViewState ? new FlyToInterpolator() : new LinearInterpolator({
        transitionProps: "zoomX" in newViewState ? ["zoomX", "zoomY"] : ["zoom"]
      });
    }
    this.setViewState(viewId, nextViewState);
  }
  handleZoomIn() {
    for (const viewId of this.viewIds) {
      this.handleZoom(viewId, 1);
    }
  }
  handleZoomOut() {
    for (const viewId of this.viewIds) {
      this.handleZoom(viewId, -1);
    }
  }
};
ZoomWidget.defaultProps = {
  ...Widget.defaultProps,
  id: "zoom",
  placement: "top-left",
  orientation: "vertical",
  transitionDuration: 200,
  zoomInLabel: "Zoom In",
  zoomOutLabel: "Zoom Out",
  zoomAxis: "all",
  viewId: null,
  onZoom: () => {
  }
};
function clamp(zoom, minZoom, maxZoom) {
  return zoom < minZoom ? minZoom : zoom > maxZoom ? maxZoom : zoom;
}
function normalizeOrthographicViewState({ zoom = 0, zoomX, zoomY, minZoom = -Infinity, maxZoom = Infinity, minZoomX = minZoom, maxZoomX = maxZoom, minZoomY = minZoom, maxZoomY = maxZoom }) {
  zoomX = zoomX ?? (Array.isArray(zoom) ? zoom[0] : zoom);
  zoomY = zoomY ?? (Array.isArray(zoom) ? zoom[1] : zoom);
  return { zoomX, zoomY, minZoomX, minZoomY, maxZoomX, maxZoomY };
}

// node_modules/@deck.gl/widgets/dist/reset-view-widget.js
var ResetViewWidget = class extends Widget {
  constructor(props = {}) {
    super(props);
    this.className = "deck-widget-reset-view";
    this.placement = "top-left";
    this.setProps(this.props);
  }
  setProps(props) {
    this.placement = props.placement ?? this.placement;
    this.viewId = props.viewId ?? this.viewId;
    super.setProps(props);
  }
  onRenderHTML(rootElement) {
    R(u2(IconButton, { className: "deck-widget-reset-focus", label: this.props.label, onClick: this.handleClick.bind(this) }), rootElement);
  }
  handleClick() {
    var _a;
    const initialViewState = this.props.initialViewState || ((_a = this.deck) == null ? void 0 : _a.props.initialViewState);
    this.resetViewState(initialViewState);
  }
  resetViewState(viewState) {
    var _a, _b;
    for (const viewId of this.viewIds) {
      const nextViewState = {
        ...(viewState == null ? void 0 : viewState[viewId]) ?? viewState
        // only works for geospatial?
        // transitionDuration: this.props.transitionDuration,
        // transitionInterpolator: new FlyToInterpolator()
      };
      (_b = (_a = this.props).onReset) == null ? void 0 : _b.call(_a, { viewId, viewState: nextViewState });
      this.setViewState(viewId, nextViewState);
    }
  }
};
ResetViewWidget.defaultProps = {
  ...Widget.defaultProps,
  id: "reset-view",
  placement: "top-left",
  label: "Reset View",
  initialViewState: void 0,
  viewId: null,
  onReset: () => {
  }
};

// node_modules/@deck.gl/widgets/dist/gimbal-widget.js
var GimbalWidget = class extends Widget {
  constructor(props = {}) {
    super(props);
    this.className = "deck-widget-gimbal";
    this.placement = "top-left";
    this.viewports = {};
    this.setProps(this.props);
  }
  setProps(props) {
    this.placement = props.placement ?? this.placement;
    this.viewId = props.viewId ?? this.viewId;
    super.setProps(props);
  }
  onRenderHTML(rootElement) {
    var _a;
    const viewId = this.viewId || ((_a = Object.values(this.viewports)[0]) == null ? void 0 : _a.id) || "default-view";
    const widgetViewport = this.viewports[viewId];
    const { rotationOrbit, rotationX } = this.getNormalizedRotation(widgetViewport);
    const ui = u2("div", { className: "deck-widget-button", style: { perspective: 100, pointerEvents: "auto" }, children: u2("button", { type: "button", onClick: () => {
      for (const viewport of Object.values(this.viewports)) {
        this.resetOrbitView(viewport);
      }
    }, title: this.props.label, style: { position: "relative", width: 26, height: 26 }, children: [u2("svg", { className: "gimbal-outer-ring", width: "100%", height: "100%", viewBox: "0 0 26 26", style: {
      position: "absolute",
      top: 0,
      left: 0,
      transform: `rotateY(${rotationOrbit}deg)`
    }, children: u2("circle", { cx: "13", cy: "13", r: "10", stroke: "var(--icon-gimbal-outer-color, rgb(68, 92, 204))", strokeWidth: this.props.strokeWidth, fill: "none" }) }), u2("svg", { className: "gimbal-inner-ring", width: "100%", height: "100%", viewBox: "0 0 26 26", style: {
      position: "absolute",
      top: 0,
      left: 0,
      transform: `rotateX(${rotationX}deg)`
    }, children: u2("circle", { cx: "13", cy: "13", r: "7", stroke: "var(--icon-gimbal-inner-color, rgb(240, 92, 68))", strokeWidth: this.props.strokeWidth, fill: "none" }) })] }) });
    R(ui, rootElement);
  }
  onViewportChange(viewport) {
    this.viewports[viewport.id] = viewport;
    this.updateHTML();
  }
  resetOrbitView(viewport) {
    var _a, _b;
    const viewId = this.viewId || (viewport == null ? void 0 : viewport.id) || "OrbitView";
    const viewState = this.getViewState(viewId);
    if ("rotationOrbit" in viewState || "rotationX" in viewState) {
      (_b = (_a = this.props).onReset) == null ? void 0 : _b.call(_a, { viewId, rotationOrbit: 0, rotationX: 0 });
      const nextViewState = {
        ...viewState,
        rotationOrbit: 0,
        rotationX: 0,
        transitionDuration: this.props.transitionDuration,
        transitionInterpolator: new LinearInterpolator({
          transitionProps: ["rotationOrbit", "rotationX"]
        })
      };
      this.setViewState(viewId, nextViewState);
    }
  }
  getNormalizedRotation(viewport) {
    const viewId = this.viewId || (viewport == null ? void 0 : viewport.id) || "OrbitView";
    const viewState = this.getViewState(viewId);
    const [rz, rx] = this.getRotation(viewState);
    const rotationOrbit = normalizeAndClampAngle(rz);
    const rotationX = normalizeAndClampAngle(rx);
    return { rotationOrbit, rotationX };
  }
  getRotation(viewState) {
    if (viewState && ("rotationOrbit" in viewState || "rotationX" in viewState)) {
      return [-(viewState.rotationOrbit || 0), viewState.rotationX || 0];
    }
    return [0, 0];
  }
};
GimbalWidget.defaultProps = {
  ...Widget.defaultProps,
  id: "gimbal",
  placement: "top-left",
  viewId: null,
  label: "Gimbal",
  strokeWidth: 1.5,
  transitionDuration: 200,
  onReset: () => {
  }
};
function normalizeAndClampAngle(angle) {
  let normalized = ((angle + 180) % 360 + 360) % 360 - 180;
  const AVOID_ANGLE_DELTA = 10;
  const distanceFrom90 = normalized - 90;
  if (Math.abs(distanceFrom90) < AVOID_ANGLE_DELTA) {
    if (distanceFrom90 < AVOID_ANGLE_DELTA) {
      normalized = 90 + AVOID_ANGLE_DELTA;
    } else if (distanceFrom90 > -AVOID_ANGLE_DELTA) {
      normalized = 90 - AVOID_ANGLE_DELTA;
    }
  }
  return normalized;
}

// node_modules/@deck.gl/widgets/dist/compass-widget.js
var CompassWidget = class extends Widget {
  constructor(props = {}) {
    super(props);
    this.className = "deck-widget-compass";
    this.placement = "top-left";
    this.viewports = {};
    this.setProps(this.props);
  }
  setProps(props) {
    this.placement = props.placement ?? this.placement;
    this.viewId = props.viewId ?? this.viewId;
    super.setProps(props);
  }
  onRenderHTML(rootElement) {
    var _a;
    const viewId = this.viewId || ((_a = Object.values(this.viewports)[0]) == null ? void 0 : _a.id);
    const widgetViewport = this.viewports[viewId];
    const [rz, rx] = this.getRotation(widgetViewport);
    const ui = u2("div", { className: "deck-widget-button", style: { perspective: 100 }, children: u2("button", { type: "button", onClick: () => {
      for (const viewport of Object.values(this.viewports)) {
        this.handleCompassReset(viewport);
      }
    }, title: this.props.label, style: { transform: `rotateX(${rx}deg)` }, children: u2("svg", { fill: "none", width: "100%", height: "100%", viewBox: "0 0 26 26", children: u2("g", { transform: `rotate(${rz},13,13)`, children: [u2("path", { d: "M10 13.0001L12.9999 5L15.9997 13.0001H10Z", fill: "var(--icon-compass-north-color, rgb(240, 92, 68))" }), u2("path", { d: "M16.0002 12.9999L13.0004 21L10.0005 12.9999H16.0002Z", fill: "var(--icon-compass-south-color, rgb(204, 204, 204))" })] }) }) }) });
    R(ui, rootElement);
  }
  onViewportChange(viewport) {
    if (!viewport.equals(this.viewports[viewport.id])) {
      this.viewports[viewport.id] = viewport;
      this.updateHTML();
    }
  }
  getRotation(viewport) {
    if (viewport instanceof web_mercator_viewport_default) {
      return [-viewport.bearing, viewport.pitch];
    } else if (viewport instanceof globe_viewport_default) {
      return [0, Math.max(-80, Math.min(80, viewport.latitude))];
    }
    return [0, 0];
  }
  handleCompassReset(viewport) {
    var _a, _b;
    const viewId = this.viewId || viewport.id;
    if (viewport instanceof web_mercator_viewport_default) {
      const viewState = this.getViewState(viewId);
      const resetPitch = this.getRotation(viewport)[0] === 0;
      const nextBearing = 0;
      const nextPitch = resetPitch ? 0 : viewport.pitch;
      (_b = (_a = this.props).onReset) == null ? void 0 : _b.call(_a, { viewId, bearing: nextBearing, pitch: nextPitch });
      const nextViewState = {
        ...viewState,
        bearing: nextBearing,
        ...resetPitch ? { pitch: nextPitch } : {},
        transitionDuration: this.props.transitionDuration,
        transitionInterpolator: new FlyToInterpolator()
      };
      this.setViewState(viewId, nextViewState);
    }
  }
};
CompassWidget.defaultProps = {
  ...Widget.defaultProps,
  id: "compass",
  placement: "top-left",
  viewId: null,
  label: "Reset Compass",
  transitionDuration: 200,
  onReset: () => {
  }
};

// node_modules/@deck.gl/widgets/dist/scale-widget.js
var ScaleWidget = class extends Widget {
  constructor(props = {}) {
    super(props);
    this.className = "deck-widget-scale";
    this.placement = "bottom-left";
    this.scaleWidth = 10;
    this.scaleValue = 0;
    this.scaleText = "";
    this.setProps(this.props);
  }
  setProps(props) {
    this.placement = props.placement ?? this.placement;
    this.viewId = props.viewId ?? this.viewId;
    super.setProps(props);
  }
  onRenderHTML(rootElement) {
    const lineOffsetX = 50;
    const svgWidth = lineOffsetX + this.scaleWidth;
    const tickHeight = 10;
    R(u2("svg", { className: "deck-widget-scale", width: svgWidth, height: 30, style: { overflow: "visible", background: "transparent" }, onClick: this.handleClick.bind(this), children: [u2("text", { x: lineOffsetX + 5, y: "10", textAnchor: "end", alignmentBaseline: "middle", style: { fontSize: "16px", fill: "black", fontWeight: "bold", fontFamily: "sans-serif" }, children: this.scaleText }), u2("line", { x1: lineOffsetX, y1: "15", x2: lineOffsetX + this.scaleWidth, y2: "15", stroke: "black", strokeWidth: "6" }), u2("line", { x1: lineOffsetX, y1: "15", x2: lineOffsetX, y2: 15 - tickHeight, stroke: "black", strokeWidth: "6" }), u2("line", { x1: lineOffsetX + this.scaleWidth, y1: "15", x2: lineOffsetX + this.scaleWidth, y2: 15 - tickHeight, stroke: "black", strokeWidth: "6" })] }), rootElement);
  }
  onViewportChange(viewport) {
    if (!("latitude" in viewport))
      return;
    const { latitude, zoom } = viewport;
    const metersPerPixel = getMetersPerPixel(latitude, zoom);
    const { candidate, candidatePixels } = computeScaleCandidate(metersPerPixel);
    this.scaleValue = candidate;
    this.scaleWidth = candidatePixels;
    if (candidate >= 1e3) {
      this.scaleText = `${(candidate / 1e3).toFixed(1)} km`;
    } else {
      this.scaleText = `${candidate} m`;
    }
    this.updateHTML();
  }
  handleClick() {
  }
};
ScaleWidget.defaultProps = {
  ...Widget.defaultProps,
  id: "scale",
  placement: "bottom-left",
  label: "Scale",
  viewId: null
};
function getMetersPerPixel(latitude, zoom) {
  const earthCircumference = 40075016686e-3;
  return earthCircumference * Math.cos(latitude * Math.PI / 180) / Math.pow(2, zoom + 8);
}
function computeScaleCandidate(metersPerPixel) {
  const minPixels = 100;
  const maxPixels = 200;
  const targetPixels = (minPixels + maxPixels) / 2;
  const targetDistance = targetPixels * metersPerPixel;
  const exponent = Math.floor(Math.log10(targetDistance));
  const base = Math.pow(10, exponent);
  const multipliers = [1, 2, 5];
  let candidate = multipliers[0] * base;
  let candidatePixels = candidate / metersPerPixel;
  for (let i4 = 0; i4 < multipliers.length; i4++) {
    const currentCandidate = multipliers[i4] * base;
    const currentPixels = currentCandidate / metersPerPixel;
    if (currentPixels >= minPixels && currentPixels <= maxPixels) {
      candidate = currentCandidate;
      candidatePixels = currentPixels;
      break;
    }
    if (currentPixels > maxPixels) {
      candidate = i4 > 0 ? multipliers[i4 - 1] * base : currentCandidate;
      candidatePixels = candidate / metersPerPixel;
      break;
    }
    if (i4 === multipliers.length - 1 && currentPixels < minPixels) {
      candidate = multipliers[0] * base * 10;
      candidatePixels = candidate / metersPerPixel;
    }
  }
  return { candidate, candidatePixels };
}

// node_modules/@deck.gl/widgets/dist/lib/components/dropdown-menu.js
function getMenuItemValue(item) {
  return typeof item === "string" ? item : item.value;
}
function getMenuItemLabel(item) {
  return typeof item === "string" ? item : item.label;
}
function getMenuItemIcon(item) {
  return typeof item === "string" ? void 0 : item.icon;
}
var DropdownMenu = (props) => {
  const [isOpen, setIsOpen] = d2(false);
  return u2(SimpleMenu, { ...props, style: { ...props.style, position: "absolute" }, isOpen, onClose: () => setIsOpen(false), trigger: u2("button", { className: "deck-widget-dropdown-button", onClick: () => setIsOpen(!isOpen), children: u2("span", { className: `deck-widget-dropdown-icon ${isOpen ? "open" : ""}` }) }) });
};
var SimpleMenu = (props) => {
  const dropdownRef = A2(null);
  h2(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        props.onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  const handleSelect = (value, item) => {
    var _a, _b;
    if (value) {
      if (typeof item === "object") {
        (_a = item.onSelect) == null ? void 0 : _a.call(item);
      }
      (_b = props.onSelect) == null ? void 0 : _b.call(props, value);
      props.onClose();
    }
  };
  if (props.menuItems.length === 0) {
    return null;
  }
  return u2("div", { className: "deck-widget-dropdown-container", ref: dropdownRef, children: [props.trigger, props.isOpen && u2("ul", { className: "deck-widget-dropdown-menu", style: props.style, children: props.menuItems.map((item, i4) => {
    const value = getMenuItemValue(item);
    const icon = getMenuItemIcon(item);
    return u2("li", { className: `deck-widget-dropdown-item ${value ? "" : "disabled"}`, onClick: () => handleSelect(value, item), children: [icon && u2("span", { className: "deck-widget-dropdown-item-icon", style: getCSSMask(icon) }), getMenuItemLabel(item)] }, i4);
  }) })] });
};

// node_modules/@deck.gl/widgets/dist/lib/geocode/geocoder-history.js
var CURRENT_LOCATION = "current";
var LOCAL_STORAGE_KEY = "deck-geocoder-history";
var GeocoderHistory = class {
  constructor(props) {
    this.addressText = "";
    this.errorText = "";
    this.addressHistory = [];
    this.props = { maxEntries: 5, ...props };
    this.addressHistory = this.loadPreviousAddresses();
  }
  /** PErform geocoding */
  async geocode(geocoder, address, apiKey) {
    this.errorText = "";
    this.addressText = address;
    try {
      const coordinates = await geocoder.geocode(address, apiKey);
      if (coordinates) {
        this.storeAddress(this.addressText);
        return coordinates;
      }
      this.errorText = "Invalid address";
    } catch (error) {
      this.errorText = `${error.message}`;
    }
    return null;
  }
  loadPreviousAddresses() {
    try {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      const list = stored && JSON.parse(stored);
      const addresses = Array.isArray(list) ? list.filter((v3) => typeof v3 === "string") : [];
      return addresses;
    } catch {
    }
    return [];
  }
  storeAddress(address) {
    const cleaned = address.trim();
    if (!cleaned || cleaned === CURRENT_LOCATION) {
      return;
    }
    const deduped = [cleaned, ...this.addressHistory.filter((a3) => a3 !== cleaned)];
    this.addressHistory = deduped.slice(0, this.props.maxEntries);
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.addressHistory));
    } catch {
    }
  }
};

// node_modules/@deck.gl/widgets/dist/lib/geocode/geocoders.js
var GOOGLE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
var MAPBOX_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";
var OPENCAGE_API_URL = "https://api.opencagedata.com/geocode/v1/json";
var GoogleGeocoder = {
  name: "google",
  requiresApiKey: true,
  async geocode(address, apiKey) {
    const encodedAddress = encodeURIComponent(address);
    const json = await fetchJson(`${GOOGLE_URL}?address=${encodedAddress}&key=${apiKey}`);
    switch (json.status) {
      case "OK":
        const loc = json.results.length > 0 && json.results[0].geometry.location;
        return loc ? { longitude: loc.lng, latitude: loc.lat } : null;
      default:
        throw new Error(`Google Geocoder failed: ${json.status}`);
    }
  }
};
var MapboxGeocoder = {
  name: "google",
  requiresApiKey: true,
  async geocode(address, apiKey) {
    const encodedAddress = encodeURIComponent(address);
    const json = await fetchJson(`${MAPBOX_URL}/${encodedAddress}.json?access_token=${apiKey}`);
    if (Array.isArray(json.features) && json.features.length > 0) {
      const center = json.features[0].center;
      if (Array.isArray(center) && center.length >= 2) {
        return { longitude: center[0], latitude: center[1] };
      }
    }
    return null;
  }
};
var OpenCageGeocoder = {
  name: "opencage",
  requiresApiKey: true,
  async geocode(address, key) {
    const encodedAddress = encodeURIComponent(address);
    const data = await fetchJson(`${OPENCAGE_API_URL}?q=${encodedAddress}&key=${key}`);
    if (Array.isArray(data.results) && data.results.length > 0) {
      const geometry = data.results[0].geometry;
      return { longitude: geometry.lng, latitude: geometry.lat };
    }
    return null;
  }
};
var CurrentLocationGeocoder = {
  name: "current",
  requiresApiKey: false,
  /** Attempt to call browsers geolocation API */
  async geocode() {
    if (!navigator.geolocation) {
      throw new Error("Geolocation not supported");
    }
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        /** @see https://developer.mozilla.org/docs/Web/API/GeolocationPosition */
        (position) => {
          const { longitude, latitude } = position.coords;
          resolve({ longitude, latitude });
        },
        /** @see https://developer.mozilla.org/docs/Web/API/GeolocationPositionError */
        (error) => reject(new Error(error.message))
      );
    });
  }
};
async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`CORS error? ${error}. ${url}: `);
  }
  if (!response.ok) {
    throw new Error(`${response.statusText}. ${url}: `);
  }
  const data = await response.json();
  if (!data) {
    throw new Error(`No data returned. ${url}`);
  }
  return data;
}
var CoordinatesGeocoder = {
  name: "coordinates",
  requiresApiKey: false,
  placeholderLocation: `-122.45, 37.8 or 37°48'N, 122°27'W`,
  async geocode(address) {
    return parseCoordinates(address) || null;
  }
};
function parseCoordinates(input) {
  input = input.trim();
  const parts = input.split(/[,;]/).map((p3) => p3.trim());
  if (parts.length < 2)
    return null;
  const first = parseCoordinatePart(parts[0]);
  const second = parseCoordinatePart(parts[1]);
  if (first === null || second === null)
    return null;
  if (Math.abs(first) > 90 && Math.abs(second) > 90) {
    return null;
  }
  if (Math.abs(first) > 90) {
    return { longitude: first, latitude: second };
  }
  if (Math.abs(second) > 90) {
    return { longitude: second, latitude: first };
  }
  return { latitude: first, longitude: second };
}
function parseCoordinatePart(s3) {
  s3 = s3.trim();
  if (s3.includes("°") || s3.includes("'") || s3.includes('"')) {
    const value2 = dmsToDecimal(s3);
    return isNaN(value2) ? null : value2;
  }
  let sign = 1;
  if (/[SW]/i.test(s3))
    sign = -1;
  s3 = s3.replace(/[NSEW]/gi, "");
  const value = parseFloat(s3);
  return isNaN(value) ? null : sign * value;
}
function dmsToDecimal(s3) {
  const regex = /(-?\d+)[°d]\s*(\d+)?['′m]?\s*(\d+(?:\.\d+)?)?[\"″s]?\s*([NSEW])?/i;
  const match = s3.match(regex);
  if (!match)
    return NaN;
  const degrees = parseFloat(match[1]) || 0;
  const minutes = parseFloat(match[2]) || 0;
  const seconds = parseFloat(match[3]) || 0;
  const direction = match[4] || "";
  const sign = degrees < 0 ? -1 : 1;
  let dec = Math.abs(degrees) + minutes / 60 + seconds / 3600;
  if (/[SW]/i.test(direction)) {
    dec = -dec;
  } else {
    dec = sign * dec;
  }
  return dec;
}

// node_modules/@deck.gl/widgets/dist/geocoder-widget.js
var CURRENT_LOCATION2 = "current";
var LOCATION_ICON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960'%3E%3Cpath d='M480-480q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Zm0 294q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 106Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Z'/%3E%3C/svg%3E`;
var CURRENT_LOCATION_ITEM = {
  label: "Current location",
  value: CURRENT_LOCATION2,
  icon: LOCATION_ICON
};
var GeocoderWidget = class extends Widget {
  constructor(props = {}) {
    super(props);
    this.className = "deck-widget-geocoder";
    this.placement = "top-left";
    this.geocodeHistory = new GeocoderHistory({});
    this.addressText = "";
    this.geocoder = CoordinatesGeocoder;
    this.isGettingLocation = false;
    this.setInput = (text) => {
      this.addressText = text;
    };
    this.handleKeyPress = (e3) => {
      if (e3.key === "Enter") {
        this.handleSubmit();
      }
    };
    this.handleSelect = (value) => {
      if (value === CURRENT_LOCATION2) {
        this.getCurrentLocation();
      } else {
        this.setInput(value);
        this.handleSubmit();
      }
    };
    this.handleSubmit = () => {
      this.geocode(this.addressText);
    };
    this.getCurrentLocation = async () => {
      this.isGettingLocation = true;
      if (this.rootElement) {
        this.updateHTML();
      }
      try {
        const coordinates = await CurrentLocationGeocoder.geocode();
        if (coordinates) {
          this.flyTo(coordinates);
        }
      } catch (error) {
        this.geocodeHistory.errorText = error instanceof Error ? error.message : "Location error";
      } finally {
        this.isGettingLocation = false;
        if (this.rootElement) {
          this.updateHTML();
        }
      }
    };
    this.geocode = async (address) => {
      const coordinates = await this.geocodeHistory.geocode(this.geocoder, this.addressText, this.props.apiKey);
      if (this.rootElement) {
        this.updateHTML();
      }
      if (coordinates) {
        this.flyTo(coordinates);
      }
    };
    this.setProps(this.props);
  }
  setProps(props) {
    this.placement = props.placement ?? this.placement;
    this.viewId = props.viewId ?? this.viewId;
    this.geocoder = getGeocoder(this.props);
    if (this.geocoder.requiresApiKey && !this.props.apiKey) {
      throw new Error(`API key is required for the ${this.geocoder.name} geocoder`);
    }
    super.setProps(props);
  }
  onRenderHTML(rootElement) {
    const menuItems = this.props._geolocation ? [CURRENT_LOCATION_ITEM, ...this.geocodeHistory.addressHistory] : [...this.geocodeHistory.addressHistory];
    R(u2("div", { className: "deck-widget-geocoder", children: [u2("input", {
      className: "deck-widget-geocoder-input",
      type: "text",
      placeholder: this.isGettingLocation ? "Finding your location..." : this.geocoder.placeholderLocation ?? "Enter address or location",
      value: this.geocodeHistory.addressText,
      // @ts-expect-error event type
      onInput: (e3) => {
        var _a;
        return this.setInput(((_a = e3.target) == null ? void 0 : _a.value) || "");
      },
      onKeyPress: this.handleKeyPress
    }), u2(DropdownMenu, { menuItems, onSelect: this.handleSelect }), this.geocodeHistory.errorText && u2("div", { className: "deck-widget-geocoder-error", children: this.geocodeHistory.errorText })] }), rootElement);
  }
  flyTo(viewState) {
    var _a, _b;
    for (const viewId of this.viewIds) {
      if ("longitude" in viewState && "latitude" in viewState) {
        (_b = (_a = this.props).onGeocode) == null ? void 0 : _b.call(_a, {
          viewId,
          coordinates: {
            longitude: viewState.longitude,
            latitude: viewState.latitude,
            zoom: viewState.zoom
          }
        });
      }
      const currentViewState = this.getViewState(viewId);
      const nextViewState = {
        ...currentViewState,
        ...viewState
      };
      if (this.props.transitionDuration > 0) {
        nextViewState.transitionDuration = this.props.transitionDuration;
        nextViewState.transitionInterpolator = "latitude" in nextViewState ? new FlyToInterpolator() : new LinearInterpolator();
      }
      this.setViewState(viewId, nextViewState);
    }
  }
};
GeocoderWidget.defaultProps = {
  ...Widget.defaultProps,
  id: "geocoder",
  viewId: null,
  placement: "top-left",
  label: "Geocoder",
  transitionDuration: 200,
  geocoder: "coordinates",
  customGeocoder: CoordinatesGeocoder,
  apiKey: "",
  _geolocation: false,
  onGeocode: () => {
  }
};
function getGeocoder(props) {
  switch (props.geocoder) {
    case "google":
      return GoogleGeocoder;
    case "mapbox":
      return MapboxGeocoder;
    case "opencage":
      return OpenCageGeocoder;
    case "coordinates":
      return CoordinatesGeocoder;
    case "custom":
      if (!props.customGeocoder) {
        throw new Error("Custom geocoder is not defined");
      }
      return props.customGeocoder;
    default:
      throw new Error(`Unknown geocoder: ${props.geocoder}`);
  }
}

// node_modules/@deck.gl/widgets/dist/fullscreen-widget.js
var FullscreenWidget = class extends Widget {
  constructor(props = {}) {
    super(props);
    this.className = "deck-widget-fullscreen";
    this.placement = "top-left";
    this.fullscreen = false;
    this.setProps(this.props);
  }
  onAdd() {
    document.addEventListener("fullscreenchange", this.onFullscreenChange.bind(this));
  }
  onRemove() {
    document.removeEventListener("fullscreenchange", this.onFullscreenChange.bind(this));
  }
  onRenderHTML(rootElement) {
    const isFullscreen = this.getFullscreen();
    R(u2(IconButton, { onClick: () => {
      this.handleClick().catch((err) => log_default.error(err)());
    }, label: isFullscreen ? this.props.exitLabel : this.props.enterLabel, className: isFullscreen ? "deck-widget-fullscreen-exit" : "deck-widget-fullscreen-enter" }), rootElement);
  }
  setProps(props) {
    this.placement = props.placement ?? this.placement;
    this.viewId = props.viewId ?? this.viewId;
    super.setProps(props);
  }
  getContainer() {
    var _a, _b, _c;
    return this.props.container || ((_a = this.deck) == null ? void 0 : _a.props.parent) || ((_c = (_b = this.deck) == null ? void 0 : _b.getCanvas()) == null ? void 0 : _c.parentElement);
  }
  getFullscreen() {
    return this.fullscreen;
  }
  onFullscreenChange() {
    var _a, _b;
    const fullscreen = document.fullscreenElement === this.getContainer();
    if (fullscreen !== this.fullscreen) {
      this.fullscreen = fullscreen;
      (_b = (_a = this.props).onFullscreenChange) == null ? void 0 : _b.call(_a, fullscreen);
      this.updateHTML();
    }
  }
  async handleClick() {
    const isFullscreen = this.getFullscreen();
    if (isFullscreen) {
      await this.exitFullscreen();
    } else {
      await this.requestFullscreen();
    }
  }
  async requestFullscreen() {
    const container = this.getContainer();
    if (container == null ? void 0 : container.requestFullscreen) {
      await container.requestFullscreen({ navigationUI: "hide" });
    } else {
      this.togglePseudoFullscreen();
    }
  }
  async exitFullscreen() {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else {
      this.togglePseudoFullscreen();
    }
  }
  togglePseudoFullscreen() {
    var _a, _b, _c;
    (_a = this.getContainer()) == null ? void 0 : _a.classList.toggle("deck-pseudo-fullscreen");
    this.fullscreen = !this.fullscreen;
    (_c = (_b = this.props).onFullscreenChange) == null ? void 0 : _c.call(_b, this.fullscreen);
    this.updateHTML();
  }
};
FullscreenWidget.defaultProps = {
  ...Widget.defaultProps,
  id: "fullscreen",
  placement: "top-left",
  viewId: null,
  enterLabel: "Enter Fullscreen",
  exitLabel: "Exit Fullscreen",
  container: void 0,
  onFullscreenChange: () => {
  }
};

// node_modules/@deck.gl/widgets/dist/splitter-widget.js
function parseViewLayout(root) {
  const layoutsById = [];
  const isViewLayout = (v3) => "views" in v3;
  function createManagedViewLayout(l3) {
    const id = layoutsById.length;
    const minSplit = l3.minSplit ?? 0.05;
    const maxSplit = l3.maxSplit ?? 0.95;
    const split = Math.min(Math.max(l3.initialSplit ?? 0.5, minSplit), maxSplit);
    const managed = {
      id,
      orientation: l3.orientation,
      views: l3.views,
      split,
      editable: l3.editable ?? true,
      minSplit,
      maxSplit,
      x: 0,
      y: 0,
      width: 0,
      height: 0
    };
    layoutsById.push(managed);
    managed.views = [
      isViewLayout(l3.views[0]) ? createManagedViewLayout(l3.views[0]) : l3.views[0],
      isViewLayout(l3.views[1]) ? createManagedViewLayout(l3.views[1]) : l3.views[1]
    ];
    return managed;
  }
  createManagedViewLayout(root);
  return layoutsById;
}
function evaluateViews(root) {
  const views = [];
  function evaluateViewLayout(l3, x2, y3, width, height) {
    l3.x = x2;
    l3.y = y3;
    l3.width = width;
    l3.height = height;
    const child1X = x2;
    const child1Y = y3;
    let child1Width = width;
    let child1Height = height;
    let child2X = x2;
    let child2Y = y3;
    let child2Width = width;
    let child2Height = height;
    if (l3.orientation === "horizontal") {
      child1Width = width * l3.split;
      child2X = x2 + child1Width;
      child2Width = width - child1Width;
    } else {
      child1Height = height * l3.split;
      child2Y = y3 + child1Height;
      child2Height = height - child1Height;
    }
    const [view1, view2] = l3.views;
    if ("views" in view1) {
      evaluateViewLayout(view1, child1X, child1Y, child1Width, child1Height);
    } else {
      views.push(view1.clone({
        x: `${child1X}%`,
        y: `${child1Y}%`,
        width: `${child1Width}%`,
        height: `${child1Height}%`
      }));
    }
    if ("views" in view2) {
      evaluateViewLayout(view2, child2X, child2Y, child2Width, child2Height);
    } else {
      views.push(view2.clone({
        x: `${child2X}%`,
        y: `${child2Y}%`,
        width: `${child2Width}%`,
        height: `${child2Height}%`
      }));
    }
  }
  evaluateViewLayout(root, 0, 0, 100, 100);
  return views;
}
var SplitterWidget = class extends Widget {
  constructor(props) {
    super(props);
    this.className = "deck-widget-splitter";
    this.placement = "fill";
    this.needsUpdate = true;
    this.viewLayouts = parseViewLayout(this.props.viewLayout);
  }
  setProps(props) {
    if (props.viewLayout && !deepEqual(props.viewLayout, this.props.viewLayout, -1)) {
      this.viewLayouts = parseViewLayout(props.viewLayout);
      this.views = void 0;
    }
    super.setProps(props);
  }
  onRedraw() {
    super.updateHTML();
  }
  // Usually widgets rerender their DOM elements here
  // In this case we need the widget UI to synchronize with deck view states
  // so we update deck props here and rerender DOM in the next onRedraw
  updateHTML() {
    if (!this.views) {
      this.views = evaluateViews(this.viewLayouts[0]);
      this.props.onChange(this.views.slice());
    }
    requestAnimationFrame(() => {
      this.doUpdate();
    });
  }
  doUpdate() {
    if (this.deck) {
      const deckViews = this.deck.props.views;
      const isManagedExternally = (
        // is not empty
        deckViews && // is not set by us
        deckViews !== this.lastViews
      );
      if (!isManagedExternally && this.lastViews !== this.views) {
        this.lastViews = this.views;
        this.deck.setProps({ views: this.views });
      }
    }
  }
  onChange(newSplit, layout) {
    layout.split = newSplit;
    this.views = evaluateViews(this.viewLayouts[0]);
    this.props.onChange(this.views.slice());
    this.doUpdate();
  }
  onRenderHTML(rootElement) {
    R(u2(S, { children: this.viewLayouts.map((layout) => layout.editable && u2(Splitter, { ...layout, onChange: (newSplit) => this.onChange(newSplit, layout), onDragStart: () => this.props.onDragStart(), onDragEnd: () => this.props.onDragStart() })) }), rootElement);
  }
};
SplitterWidget.defaultProps = {
  ...Widget.defaultProps,
  id: "splitter-widget",
  viewLayout: void 0,
  onChange: () => {
  },
  onDragStart: () => {
  },
  onDragEnd: () => {
  }
};
function Splitter({ orientation, x: x2, y: y3, width, height, split, minSplit, maxSplit, onChange, onDragStart, onDragEnd }) {
  const [dragging, setDragging] = d2(false);
  const containerRef = A2(null);
  h2(() => {
    if (!dragging) {
      return void 0;
    }
    const handleDragging = (event) => {
      if (!containerRef.current)
        return;
      const rect = containerRef.current.getBoundingClientRect();
      let newSplit;
      if (orientation === "horizontal") {
        newSplit = (event.clientX - rect.left) / rect.width;
      } else {
        newSplit = (event.clientY - rect.top) / rect.height;
      }
      newSplit = Math.min(Math.max(newSplit, minSplit), maxSplit);
      onChange == null ? void 0 : onChange(newSplit);
    };
    const handleDragEnd = () => {
      onDragEnd == null ? void 0 : onDragEnd();
      setDragging(false);
    };
    document.addEventListener("pointermove", handleDragging);
    document.addEventListener("pointerup", handleDragEnd);
    document.addEventListener("pointerleave", handleDragEnd);
    return () => {
      document.removeEventListener("pointermove", handleDragging);
      document.removeEventListener("pointerup", handleDragEnd);
      document.removeEventListener("pointerleave", handleDragEnd);
    };
  }, [dragging]);
  const handleDragStart = (event) => {
    setDragging(true);
    onDragStart == null ? void 0 : onDragStart();
    event.preventDefault();
  };
  const splitterStyle = orientation === "horizontal" ? { left: `${split * 100}%` } : { top: `${split * 100}%` };
  const containerStyle = {
    position: "absolute",
    top: `${y3}%`,
    left: `${x2}%`,
    width: `${width}%`,
    height: `${height}%`
  };
  return u2("div", { ref: containerRef, style: containerStyle, children: u2("div", { className: `deck-widget-splitter-handle deck-widget-splitter-handle--${orientation} ${dragging ? "active" : ""}`, style: splitterStyle, onPointerDown: handleDragStart }) });
}

// node_modules/@floating-ui/utils/dist/floating-ui.utils.mjs
var sides = ["top", "right", "bottom", "left"];
var alignments = ["start", "end"];
var placements = sides.reduce((acc, side) => acc.concat(side, side + "-" + alignments[0], side + "-" + alignments[1]), []);
var min = Math.min;
var max = Math.max;
var round = Math.round;
var floor = Math.floor;
var createCoords = (v3) => ({
  x: v3,
  y: v3
});
var oppositeSideMap = {
  left: "right",
  right: "left",
  bottom: "top",
  top: "bottom"
};
function clamp2(start, value, end) {
  return max(start, min(value, end));
}
function evaluate(value, param) {
  return typeof value === "function" ? value(param) : value;
}
function getSide(placement) {
  return placement.split("-")[0];
}
function getAlignment(placement) {
  return placement.split("-")[1];
}
function getOppositeAxis(axis) {
  return axis === "x" ? "y" : "x";
}
function getAxisLength(axis) {
  return axis === "y" ? "height" : "width";
}
function getSideAxis(placement) {
  const firstChar = placement[0];
  return firstChar === "t" || firstChar === "b" ? "y" : "x";
}
function getAlignmentAxis(placement) {
  return getOppositeAxis(getSideAxis(placement));
}
function getAlignmentSides(placement, rects, rtl) {
  if (rtl === void 0) {
    rtl = false;
  }
  const alignment = getAlignment(placement);
  const alignmentAxis = getAlignmentAxis(placement);
  const length = getAxisLength(alignmentAxis);
  let mainAlignmentSide = alignmentAxis === "x" ? alignment === (rtl ? "end" : "start") ? "right" : "left" : alignment === "start" ? "bottom" : "top";
  if (rects.reference[length] > rects.floating[length]) {
    mainAlignmentSide = getOppositePlacement(mainAlignmentSide);
  }
  return [mainAlignmentSide, getOppositePlacement(mainAlignmentSide)];
}
function getExpandedPlacements(placement) {
  const oppositePlacement = getOppositePlacement(placement);
  return [getOppositeAlignmentPlacement(placement), oppositePlacement, getOppositeAlignmentPlacement(oppositePlacement)];
}
function getOppositeAlignmentPlacement(placement) {
  return placement.includes("start") ? placement.replace("start", "end") : placement.replace("end", "start");
}
var lrPlacement = ["left", "right"];
var rlPlacement = ["right", "left"];
var tbPlacement = ["top", "bottom"];
var btPlacement = ["bottom", "top"];
function getSideList(side, isStart, rtl) {
  switch (side) {
    case "top":
    case "bottom":
      if (rtl) return isStart ? rlPlacement : lrPlacement;
      return isStart ? lrPlacement : rlPlacement;
    case "left":
    case "right":
      return isStart ? tbPlacement : btPlacement;
    default:
      return [];
  }
}
function getOppositeAxisPlacements(placement, flipAlignment, direction, rtl) {
  const alignment = getAlignment(placement);
  let list = getSideList(getSide(placement), direction === "start", rtl);
  if (alignment) {
    list = list.map((side) => side + "-" + alignment);
    if (flipAlignment) {
      list = list.concat(list.map(getOppositeAlignmentPlacement));
    }
  }
  return list;
}
function getOppositePlacement(placement) {
  const side = getSide(placement);
  return oppositeSideMap[side] + placement.slice(side.length);
}
function expandPaddingObject(padding) {
  var _padding$top, _padding$right, _padding$bottom, _padding$left;
  return {
    top: (_padding$top = padding.top) != null ? _padding$top : 0,
    right: (_padding$right = padding.right) != null ? _padding$right : 0,
    bottom: (_padding$bottom = padding.bottom) != null ? _padding$bottom : 0,
    left: (_padding$left = padding.left) != null ? _padding$left : 0
  };
}
function getPaddingObject(padding) {
  return typeof padding !== "number" ? expandPaddingObject(padding) : {
    top: padding,
    right: padding,
    bottom: padding,
    left: padding
  };
}
function rectToClientRect(rect) {
  const {
    x: x2,
    y: y3,
    width,
    height
  } = rect;
  return {
    width,
    height,
    top: y3,
    left: x2,
    right: x2 + width,
    bottom: y3 + height,
    x: x2,
    y: y3
  };
}

// node_modules/@floating-ui/core/dist/floating-ui.core.mjs
function computeCoordsFromPlacement(_ref, placement, rtl) {
  let {
    reference,
    floating
  } = _ref;
  const sideAxis = getSideAxis(placement);
  const alignmentAxis = getAlignmentAxis(placement);
  const alignLength = getAxisLength(alignmentAxis);
  const side = getSide(placement);
  const isVertical = sideAxis === "y";
  const commonX = reference.x + reference.width / 2 - floating.width / 2;
  const commonY = reference.y + reference.height / 2 - floating.height / 2;
  const commonAlign = reference[alignLength] / 2 - floating[alignLength] / 2;
  let coords;
  switch (side) {
    case "top":
      coords = {
        x: commonX,
        y: reference.y - floating.height
      };
      break;
    case "bottom":
      coords = {
        x: commonX,
        y: reference.y + reference.height
      };
      break;
    case "right":
      coords = {
        x: reference.x + reference.width,
        y: commonY
      };
      break;
    case "left":
      coords = {
        x: reference.x - floating.width,
        y: commonY
      };
      break;
    default:
      coords = {
        x: reference.x,
        y: reference.y
      };
  }
  const alignment = getAlignment(placement);
  if (alignment) {
    coords[alignmentAxis] += commonAlign * (alignment === "end" ? 1 : -1) * (rtl && isVertical ? -1 : 1);
  }
  return coords;
}
async function detectOverflow(state, options) {
  var _await$platform$isEle;
  if (options === void 0) {
    options = {};
  }
  const {
    x: x2,
    y: y3,
    platform: platform2,
    rects,
    elements,
    strategy
  } = state;
  const {
    boundary = "clippingAncestors",
    rootBoundary = "viewport",
    elementContext = "floating",
    altBoundary = false,
    padding = 0
  } = evaluate(options, state);
  const paddingObject = getPaddingObject(padding);
  const altContext = elementContext === "floating" ? "reference" : "floating";
  const element = elements[altBoundary ? altContext : elementContext];
  const clippingClientRect = rectToClientRect(await platform2.getClippingRect({
    element: ((_await$platform$isEle = await (platform2.isElement == null ? void 0 : platform2.isElement(element))) != null ? _await$platform$isEle : true) ? element : element.contextElement || await (platform2.getDocumentElement == null ? void 0 : platform2.getDocumentElement(elements.floating)),
    boundary,
    rootBoundary,
    strategy
  }));
  const rect = elementContext === "floating" ? {
    x: x2,
    y: y3,
    width: rects.floating.width,
    height: rects.floating.height
  } : rects.reference;
  const offsetParent = await (platform2.getOffsetParent == null ? void 0 : platform2.getOffsetParent(elements.floating));
  const offsetScale = await (platform2.isElement == null ? void 0 : platform2.isElement(offsetParent)) && await (platform2.getScale == null ? void 0 : platform2.getScale(offsetParent)) || {
    x: 1,
    y: 1
  };
  const elementClientRect = rectToClientRect(platform2.convertOffsetParentRelativeRectToViewportRelativeRect ? await platform2.convertOffsetParentRelativeRectToViewportRelativeRect({
    elements,
    rect,
    offsetParent,
    strategy
  }) : rect);
  return {
    top: (clippingClientRect.top - elementClientRect.top + paddingObject.top) / offsetScale.y,
    bottom: (elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom) / offsetScale.y,
    left: (clippingClientRect.left - elementClientRect.left + paddingObject.left) / offsetScale.x,
    right: (elementClientRect.right - clippingClientRect.right + paddingObject.right) / offsetScale.x
  };
}
var MAX_RESET_COUNT = 50;
var computePosition = async (reference, floating, config) => {
  const {
    placement = "bottom",
    strategy = "absolute",
    middleware = [],
    platform: platform2
  } = config;
  const platformWithDetectOverflow = platform2.detectOverflow ? platform2 : {
    ...platform2,
    detectOverflow
  };
  const rtl = await (platform2.isRTL == null ? void 0 : platform2.isRTL(floating));
  let rects = await platform2.getElementRects({
    reference,
    floating,
    strategy
  });
  let {
    x: x2,
    y: y3
  } = computeCoordsFromPlacement(rects, placement, rtl);
  let statefulPlacement = placement;
  let resetCount = 0;
  const middlewareData = {};
  for (let i4 = 0; i4 < middleware.length; i4++) {
    const currentMiddleware = middleware[i4];
    if (!currentMiddleware) {
      continue;
    }
    const {
      name,
      fn
    } = currentMiddleware;
    const {
      x: nextX,
      y: nextY,
      data,
      reset
    } = await fn({
      x: x2,
      y: y3,
      initialPlacement: placement,
      placement: statefulPlacement,
      strategy,
      middlewareData,
      rects,
      platform: platformWithDetectOverflow,
      elements: {
        reference,
        floating
      }
    });
    x2 = nextX != null ? nextX : x2;
    y3 = nextY != null ? nextY : y3;
    middlewareData[name] = {
      ...middlewareData[name],
      ...data
    };
    if (reset && resetCount < MAX_RESET_COUNT) {
      resetCount++;
      if (typeof reset === "object") {
        if (reset.placement) {
          statefulPlacement = reset.placement;
        }
        if (reset.rects) {
          rects = reset.rects === true ? await platform2.getElementRects({
            reference,
            floating,
            strategy
          }) : reset.rects;
        }
        ({
          x: x2,
          y: y3
        } = computeCoordsFromPlacement(rects, statefulPlacement, rtl));
      }
      i4 = -1;
    }
  }
  return {
    x: x2,
    y: y3,
    placement: statefulPlacement,
    strategy,
    middlewareData
  };
};
var arrow = (options) => ({
  name: "arrow",
  options,
  async fn(state) {
    const {
      x: x2,
      y: y3,
      placement,
      rects,
      platform: platform2,
      elements,
      middlewareData
    } = state;
    const {
      element,
      padding = 0
    } = evaluate(options, state) || {};
    if (element == null) {
      return {};
    }
    const paddingObject = getPaddingObject(padding);
    const coords = {
      x: x2,
      y: y3
    };
    const axis = getAlignmentAxis(placement);
    const length = getAxisLength(axis);
    const arrowDimensions = await platform2.getDimensions(element);
    const isYAxis = axis === "y";
    const minProp = isYAxis ? "top" : "left";
    const maxProp = isYAxis ? "bottom" : "right";
    const clientProp = isYAxis ? "clientHeight" : "clientWidth";
    const endDiff = rects.reference[length] + rects.reference[axis] - coords[axis] - rects.floating[length];
    const startDiff = coords[axis] - rects.reference[axis];
    const arrowOffsetParent = await (platform2.getOffsetParent == null ? void 0 : platform2.getOffsetParent(element));
    let clientSize = arrowOffsetParent ? arrowOffsetParent[clientProp] : 0;
    if (!clientSize || !await (platform2.isElement == null ? void 0 : platform2.isElement(arrowOffsetParent))) {
      clientSize = elements.floating[clientProp] || rects.floating[length];
    }
    const centerToReference = endDiff / 2 - startDiff / 2;
    const largestPossiblePadding = clientSize / 2 - arrowDimensions[length] / 2 - 1;
    const minPadding = min(paddingObject[minProp], largestPossiblePadding);
    const maxPadding = min(paddingObject[maxProp], largestPossiblePadding);
    const max2 = clientSize - arrowDimensions[length] - maxPadding;
    const center = clientSize / 2 - arrowDimensions[length] / 2 + centerToReference;
    const offset3 = clamp2(minPadding, center, max2);
    const shouldAddOffset = !middlewareData.arrow && getAlignment(placement) != null && center !== offset3 && rects.reference[length] / 2 - (center < minPadding ? minPadding : maxPadding) - arrowDimensions[length] / 2 < 0;
    const alignmentOffset = shouldAddOffset ? center < minPadding ? center - minPadding : center - max2 : 0;
    return {
      [axis]: coords[axis] + alignmentOffset,
      data: {
        [axis]: offset3,
        centerOffset: center - offset3 - alignmentOffset,
        ...shouldAddOffset && {
          alignmentOffset
        }
      },
      reset: shouldAddOffset
    };
  }
});
var flip = function(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: "flip",
    options,
    async fn(state) {
      var _middlewareData$arrow, _middlewareData$flip;
      const {
        placement,
        middlewareData,
        rects,
        initialPlacement,
        platform: platform2,
        elements
      } = state;
      const {
        mainAxis: checkMainAxis = true,
        crossAxis: checkCrossAxis = true,
        fallbackPlacements: specifiedFallbackPlacements,
        fallbackStrategy = "bestFit",
        fallbackAxisSideDirection = "none",
        flipAlignment = true,
        ...detectOverflowOptions
      } = evaluate(options, state);
      if ((_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) {
        return {};
      }
      const side = getSide(placement);
      const initialSideAxis = getSideAxis(initialPlacement);
      const isBasePlacement = getSide(initialPlacement) === initialPlacement;
      const rtl = await (platform2.isRTL == null ? void 0 : platform2.isRTL(elements.floating));
      const fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipAlignment ? [getOppositePlacement(initialPlacement)] : getExpandedPlacements(initialPlacement));
      const hasFallbackAxisSideDirection = fallbackAxisSideDirection !== "none";
      if (!specifiedFallbackPlacements && hasFallbackAxisSideDirection) {
        fallbackPlacements.push(...getOppositeAxisPlacements(initialPlacement, flipAlignment, fallbackAxisSideDirection, rtl));
      }
      const placements2 = [initialPlacement, ...fallbackPlacements];
      const overflow = await platform2.detectOverflow(state, detectOverflowOptions);
      const overflows = [];
      let overflowsData = ((_middlewareData$flip = middlewareData.flip) == null ? void 0 : _middlewareData$flip.overflows) || [];
      if (checkMainAxis) {
        overflows.push(overflow[side]);
      }
      if (checkCrossAxis) {
        const sides2 = getAlignmentSides(placement, rects, rtl);
        overflows.push(overflow[sides2[0]], overflow[sides2[1]]);
      }
      overflowsData = [...overflowsData, {
        placement,
        overflows
      }];
      if (!overflows.every((side2) => side2 <= 0)) {
        var _middlewareData$flip2, _overflowsData$filter;
        const nextIndex = (((_middlewareData$flip2 = middlewareData.flip) == null ? void 0 : _middlewareData$flip2.index) || 0) + 1;
        const nextPlacement = placements2[nextIndex];
        if (nextPlacement) {
          const ignoreCrossAxisOverflow = checkCrossAxis === "alignment" ? initialSideAxis !== getSideAxis(nextPlacement) : false;
          if (!ignoreCrossAxisOverflow || // We leave the current main axis only if every placement on that axis
          // overflows the main axis.
          overflowsData.every((d3) => getSideAxis(d3.placement) === initialSideAxis ? d3.overflows[0] > 0 : true)) {
            return {
              data: {
                index: nextIndex,
                overflows: overflowsData
              },
              reset: {
                placement: nextPlacement
              }
            };
          }
        }
        let resetPlacement = (_overflowsData$filter = overflowsData.filter((d3) => d3.overflows[0] <= 0).sort((a3, b2) => a3.overflows[1] - b2.overflows[1])[0]) == null ? void 0 : _overflowsData$filter.placement;
        if (!resetPlacement) {
          switch (fallbackStrategy) {
            case "bestFit": {
              var _overflowsData$filter2;
              const placement2 = (_overflowsData$filter2 = overflowsData.filter((d3) => {
                if (hasFallbackAxisSideDirection) {
                  const currentSideAxis = getSideAxis(d3.placement);
                  return currentSideAxis === initialSideAxis || // Create a bias to the `y` side axis due to horizontal
                  // reading directions favoring greater width.
                  currentSideAxis === "y";
                }
                return true;
              }).map((d3) => [d3.placement, d3.overflows.filter((overflow2) => overflow2 > 0).reduce((acc, overflow2) => acc + overflow2, 0)]).sort((a3, b2) => a3[1] - b2[1])[0]) == null ? void 0 : _overflowsData$filter2[0];
              if (placement2) {
                resetPlacement = placement2;
              }
              break;
            }
            case "initialPlacement":
              resetPlacement = initialPlacement;
              break;
          }
        }
        if (placement !== resetPlacement) {
          return {
            reset: {
              placement: resetPlacement
            }
          };
        }
      }
      return {};
    }
  };
};
var originSides = /* @__PURE__ */ new Set(["left", "top"]);
async function convertValueToCoords(state, options) {
  const {
    placement,
    platform: platform2,
    elements
  } = state;
  const rtl = await (platform2.isRTL == null ? void 0 : platform2.isRTL(elements.floating));
  const side = getSide(placement);
  const alignment = getAlignment(placement);
  const isVertical = getSideAxis(placement) === "y";
  const mainAxisMulti = originSides.has(side) ? -1 : 1;
  const crossAxisMulti = rtl && isVertical ? -1 : 1;
  const rawValue = evaluate(options, state);
  let {
    mainAxis,
    crossAxis,
    alignmentAxis
  } = typeof rawValue === "number" ? {
    mainAxis: rawValue,
    crossAxis: 0,
    alignmentAxis: null
  } : {
    mainAxis: rawValue.mainAxis || 0,
    crossAxis: rawValue.crossAxis || 0,
    alignmentAxis: rawValue.alignmentAxis
  };
  if (alignment && typeof alignmentAxis === "number") {
    crossAxis = alignment === "end" ? alignmentAxis * -1 : alignmentAxis;
  }
  return isVertical ? {
    x: crossAxis * crossAxisMulti,
    y: mainAxis * mainAxisMulti
  } : {
    x: mainAxis * mainAxisMulti,
    y: crossAxis * crossAxisMulti
  };
}
var offset = function(options) {
  if (options === void 0) {
    options = 0;
  }
  return {
    name: "offset",
    options,
    async fn(state) {
      var _middlewareData$offse, _middlewareData$arrow;
      const {
        x: x2,
        y: y3,
        placement,
        middlewareData
      } = state;
      const diffCoords = await convertValueToCoords(state, options);
      if (placement === ((_middlewareData$offse = middlewareData.offset) == null ? void 0 : _middlewareData$offse.placement) && (_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) {
        return {};
      }
      return {
        x: x2 + diffCoords.x,
        y: y3 + diffCoords.y,
        data: {
          ...diffCoords,
          placement
        }
      };
    }
  };
};
var shift = function(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: "shift",
    options,
    async fn(state) {
      const {
        x: x2,
        y: y3,
        placement,
        platform: platform2
      } = state;
      const {
        mainAxis: checkMainAxis = true,
        crossAxis: checkCrossAxis = false,
        limiter = {
          fn: (_ref) => {
            let {
              x: x3,
              y: y4
            } = _ref;
            return {
              x: x3,
              y: y4
            };
          }
        },
        ...detectOverflowOptions
      } = evaluate(options, state);
      const coords = {
        x: x2,
        y: y3
      };
      const overflow = await platform2.detectOverflow(state, detectOverflowOptions);
      const crossAxis = getSideAxis(placement);
      const mainAxis = getOppositeAxis(crossAxis);
      let mainAxisCoord = coords[mainAxis];
      let crossAxisCoord = coords[crossAxis];
      const clampCoord = (axis, coord) => clamp2(coord + overflow[axis === "y" ? "top" : "left"], coord, coord - overflow[axis === "y" ? "bottom" : "right"]);
      if (checkMainAxis) {
        mainAxisCoord = clampCoord(mainAxis, mainAxisCoord);
      }
      if (checkCrossAxis) {
        crossAxisCoord = clampCoord(crossAxis, crossAxisCoord);
      }
      const limitedCoords = limiter.fn({
        ...state,
        [mainAxis]: mainAxisCoord,
        [crossAxis]: crossAxisCoord
      });
      return {
        ...limitedCoords,
        data: {
          x: limitedCoords.x - x2,
          y: limitedCoords.y - y3,
          enabled: {
            [mainAxis]: checkMainAxis,
            [crossAxis]: checkCrossAxis
          }
        }
      };
    }
  };
};

// node_modules/@floating-ui/utils/dist/floating-ui.utils.dom.mjs
function hasWindow() {
  return typeof window !== "undefined";
}
function getNodeName(node) {
  if (isNode(node)) {
    return (node.nodeName || "").toLowerCase();
  }
  return "#document";
}
function getWindow(node) {
  var _node$ownerDocument;
  return (node == null || (_node$ownerDocument = node.ownerDocument) == null ? void 0 : _node$ownerDocument.defaultView) || window;
}
function getDocumentElement(node) {
  var _ref;
  return (_ref = (isNode(node) ? node.ownerDocument : node.document) || window.document) == null ? void 0 : _ref.documentElement;
}
function isNode(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof Node || value instanceof getWindow(value).Node;
}
function isElement(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof Element || value instanceof getWindow(value).Element;
}
function isHTMLElement(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof HTMLElement || value instanceof getWindow(value).HTMLElement;
}
function isShadowRoot(value) {
  if (!hasWindow() || typeof ShadowRoot === "undefined") {
    return false;
  }
  return value instanceof ShadowRoot || value instanceof getWindow(value).ShadowRoot;
}
function isOverflowElement(element) {
  const {
    overflow,
    overflowX,
    overflowY,
    display
  } = getComputedStyle2(element);
  return /auto|scroll|overlay|hidden|clip/.test(overflow + overflowY + overflowX) && display !== "inline" && display !== "contents";
}
function isTableElement(element) {
  return /^(table|td|th)$/.test(getNodeName(element));
}
function isTopLayer(element) {
  try {
    if (element.matches(":popover-open")) {
      return true;
    }
  } catch (_e) {
  }
  try {
    return element.matches(":modal");
  } catch (_e) {
    return false;
  }
}
var willChangeRe = /transform|translate|scale|rotate|perspective|filter/;
var containRe = /paint|layout|strict|content/;
var isNotNone = (value) => !!value && value !== "none";
var isWebKitValue;
function isContainingBlock(elementOrCss) {
  const css = isElement(elementOrCss) ? getComputedStyle2(elementOrCss) : elementOrCss;
  return isNotNone(css.transform) || isNotNone(css.translate) || isNotNone(css.scale) || isNotNone(css.rotate) || isNotNone(css.perspective) || !isWebKit() && (isNotNone(css.backdropFilter) || isNotNone(css.filter)) || willChangeRe.test(css.willChange || "") || containRe.test(css.contain || "");
}
function getContainingBlock(element) {
  let currentNode = getParentNode(element);
  while (isHTMLElement(currentNode) && !isLastTraversableNode(currentNode)) {
    if (isContainingBlock(currentNode)) {
      return currentNode;
    } else if (isTopLayer(currentNode)) {
      return null;
    }
    currentNode = getParentNode(currentNode);
  }
  return null;
}
function isWebKit() {
  if (isWebKitValue == null) {
    isWebKitValue = typeof CSS !== "undefined" && CSS.supports && CSS.supports("-webkit-backdrop-filter", "none");
  }
  return isWebKitValue;
}
function isLastTraversableNode(node) {
  return /^(html|body|#document)$/.test(getNodeName(node));
}
function getComputedStyle2(element) {
  return getWindow(element).getComputedStyle(element);
}
function getNodeScroll(element) {
  if (isElement(element)) {
    return {
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop
    };
  }
  return {
    scrollLeft: element.scrollX,
    scrollTop: element.scrollY
  };
}
function getParentNode(node) {
  if (getNodeName(node) === "html") {
    return node;
  }
  const result = (
    // Step into the shadow DOM of the parent of a slotted node.
    node.assignedSlot || // DOM Element detected.
    node.parentNode || // ShadowRoot detected.
    isShadowRoot(node) && node.host || // Fallback.
    getDocumentElement(node)
  );
  return isShadowRoot(result) ? result.host : result;
}
function getNearestOverflowAncestor(node) {
  const parentNode = getParentNode(node);
  if (isLastTraversableNode(parentNode)) {
    return (node.ownerDocument || node).body;
  }
  if (isHTMLElement(parentNode) && isOverflowElement(parentNode)) {
    return parentNode;
  }
  return getNearestOverflowAncestor(parentNode);
}
function getOverflowAncestors(node, list, traverseIframes) {
  var _node$ownerDocument2;
  if (list === void 0) {
    list = [];
  }
  if (traverseIframes === void 0) {
    traverseIframes = true;
  }
  const scrollableAncestor = getNearestOverflowAncestor(node);
  const isBody = scrollableAncestor === ((_node$ownerDocument2 = node.ownerDocument) == null ? void 0 : _node$ownerDocument2.body);
  const win = getWindow(scrollableAncestor);
  if (isBody) {
    const frameElement = getFrameElement(win);
    return list.concat(win, win.visualViewport || [], isOverflowElement(scrollableAncestor) ? scrollableAncestor : [], frameElement && traverseIframes ? getOverflowAncestors(frameElement) : []);
  } else {
    return list.concat(scrollableAncestor, getOverflowAncestors(scrollableAncestor, [], traverseIframes));
  }
}
function getFrameElement(win) {
  return win.parent && Object.getPrototypeOf(win.parent) ? win.frameElement : null;
}

// node_modules/@floating-ui/dom/dist/floating-ui.dom.mjs
function getCssDimensions(element) {
  const css = getComputedStyle2(element);
  let width = parseFloat(css.width) || 0;
  let height = parseFloat(css.height) || 0;
  const hasOffset = isHTMLElement(element);
  const offsetWidth = hasOffset ? element.offsetWidth : width;
  const offsetHeight = hasOffset ? element.offsetHeight : height;
  const shouldFallback = round(width) !== offsetWidth || round(height) !== offsetHeight;
  if (shouldFallback) {
    width = offsetWidth;
    height = offsetHeight;
  }
  return {
    width,
    height,
    $: shouldFallback
  };
}
function unwrapElement(element) {
  return !isElement(element) ? element.contextElement : element;
}
function getScale(element) {
  const domElement = unwrapElement(element);
  if (!isHTMLElement(domElement)) {
    return createCoords(1);
  }
  const rect = domElement.getBoundingClientRect();
  const {
    width,
    height,
    $: $2
  } = getCssDimensions(domElement);
  let x2 = ($2 ? round(rect.width) : rect.width) / width;
  let y3 = ($2 ? round(rect.height) : rect.height) / height;
  if (!x2 || !Number.isFinite(x2)) {
    x2 = 1;
  }
  if (!y3 || !Number.isFinite(y3)) {
    y3 = 1;
  }
  return {
    x: x2,
    y: y3
  };
}
var noOffsets = createCoords(0);
function getVisualOffsets(element) {
  const win = getWindow(element);
  if (!isWebKit() || !win.visualViewport) {
    return noOffsets;
  }
  return {
    x: win.visualViewport.offsetLeft,
    y: win.visualViewport.offsetTop
  };
}
function shouldAddVisualOffsets(element, isFixed, floatingOffsetParent) {
  if (isFixed === void 0) {
    isFixed = false;
  }
  return !!floatingOffsetParent && isFixed && floatingOffsetParent === getWindow(element);
}
function getBoundingClientRect(element, includeScale, isFixedStrategy, offsetParent) {
  if (includeScale === void 0) {
    includeScale = false;
  }
  if (isFixedStrategy === void 0) {
    isFixedStrategy = false;
  }
  const clientRect = element.getBoundingClientRect();
  const domElement = unwrapElement(element);
  let scale = createCoords(1);
  if (includeScale) {
    if (offsetParent) {
      if (isElement(offsetParent)) {
        scale = getScale(offsetParent);
      }
    } else {
      scale = getScale(element);
    }
  }
  const visualOffsets = shouldAddVisualOffsets(domElement, isFixedStrategy, offsetParent) ? getVisualOffsets(domElement) : createCoords(0);
  let x2 = (clientRect.left + visualOffsets.x) / scale.x;
  let y3 = (clientRect.top + visualOffsets.y) / scale.y;
  let width = clientRect.width / scale.x;
  let height = clientRect.height / scale.y;
  if (domElement && offsetParent) {
    const win = getWindow(domElement);
    const offsetWin = isElement(offsetParent) ? getWindow(offsetParent) : offsetParent;
    let currentWin = win;
    let currentIFrame = getFrameElement(currentWin);
    while (currentIFrame && offsetWin !== currentWin) {
      const iframeScale = getScale(currentIFrame);
      const iframeRect = currentIFrame.getBoundingClientRect();
      const css = getComputedStyle2(currentIFrame);
      const left = iframeRect.left + (currentIFrame.clientLeft + parseFloat(css.paddingLeft)) * iframeScale.x;
      const top = iframeRect.top + (currentIFrame.clientTop + parseFloat(css.paddingTop)) * iframeScale.y;
      x2 *= iframeScale.x;
      y3 *= iframeScale.y;
      width *= iframeScale.x;
      height *= iframeScale.y;
      x2 += left;
      y3 += top;
      currentWin = getWindow(currentIFrame);
      currentIFrame = getFrameElement(currentWin);
    }
  }
  return rectToClientRect({
    width,
    height,
    x: x2,
    y: y3
  });
}
function getWindowScrollBarX(element, rect) {
  const leftScroll = getNodeScroll(element).scrollLeft;
  if (!rect) {
    return getBoundingClientRect(getDocumentElement(element)).left + leftScroll;
  }
  return rect.left + leftScroll;
}
function getHTMLOffset(documentElement, scroll) {
  const htmlRect = documentElement.getBoundingClientRect();
  const x2 = htmlRect.left + scroll.scrollLeft - getWindowScrollBarX(documentElement, htmlRect);
  const y3 = htmlRect.top + scroll.scrollTop;
  return {
    x: x2,
    y: y3
  };
}
function convertOffsetParentRelativeRectToViewportRelativeRect(_ref) {
  let {
    elements,
    rect,
    offsetParent,
    strategy
  } = _ref;
  const isFixed = strategy === "fixed";
  const documentElement = getDocumentElement(offsetParent);
  const topLayer = elements ? isTopLayer(elements.floating) : false;
  if (offsetParent === documentElement || topLayer && isFixed) {
    return rect;
  }
  let scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  let scale = createCoords(1);
  const offsets = createCoords(0);
  const isOffsetParentAnElement = isHTMLElement(offsetParent);
  if (isOffsetParentAnElement || !isFixed) {
    if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isOffsetParentAnElement) {
      const offsetRect = getBoundingClientRect(offsetParent);
      scale = getScale(offsetParent);
      offsets.x = offsetRect.x + offsetParent.clientLeft;
      offsets.y = offsetRect.y + offsetParent.clientTop;
    }
  }
  const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
  return {
    width: rect.width * scale.x,
    height: rect.height * scale.y,
    x: rect.x * scale.x - scroll.scrollLeft * scale.x + offsets.x + htmlOffset.x,
    y: rect.y * scale.y - scroll.scrollTop * scale.y + offsets.y + htmlOffset.y
  };
}
function getClientRects(element) {
  return element.getClientRects ? Array.from(element.getClientRects()) : [];
}
function getDocumentRect(html) {
  const scroll = getNodeScroll(html);
  const body = html.ownerDocument.body;
  const width = max(html.scrollWidth, html.clientWidth, body.scrollWidth, body.clientWidth);
  const height = max(html.scrollHeight, html.clientHeight, body.scrollHeight, body.clientHeight);
  let x2 = -scroll.scrollLeft + getWindowScrollBarX(html);
  const y3 = -scroll.scrollTop;
  if (getComputedStyle2(body).direction === "rtl") {
    x2 += max(html.clientWidth, body.clientWidth) - width;
  }
  return {
    width,
    height,
    x: x2,
    y: y3
  };
}
var SCROLLBAR_MAX = 25;
function getViewportRect(element, strategy, rootBoundary) {
  if (rootBoundary === void 0) {
    rootBoundary = "viewport";
  }
  const isLayoutViewport = rootBoundary === "layoutViewport";
  const win = getWindow(element);
  const html = getDocumentElement(element);
  const visualViewport = win.visualViewport;
  let width = html.clientWidth;
  let height = html.clientHeight;
  let x2 = 0;
  let y3 = 0;
  if (visualViewport) {
    const layoutRelativeClientCoords = !isWebKit() || strategy === "fixed";
    if (isLayoutViewport) {
      if (!layoutRelativeClientCoords) {
        x2 = -visualViewport.offsetLeft;
        y3 = -visualViewport.offsetTop;
      }
    } else {
      width = visualViewport.width;
      height = visualViewport.height;
      if (layoutRelativeClientCoords) {
        x2 = visualViewport.offsetLeft;
        y3 = visualViewport.offsetTop;
      }
    }
  }
  const windowScrollbarX = getWindowScrollBarX(html);
  if (windowScrollbarX <= 0) {
    const doc = html.ownerDocument;
    const body = doc.body;
    const bodyStyles = getComputedStyle(body);
    const bodyMarginInline = doc.compatMode === "CSS1Compat" ? parseFloat(bodyStyles.marginLeft) + parseFloat(bodyStyles.marginRight) || 0 : 0;
    const reservedWidth = Math.abs(html.clientWidth - body.clientWidth - bodyMarginInline);
    const gutter = getComputedStyle(html).scrollbarGutter === "stable both-edges" ? reservedWidth / 2 : reservedWidth;
    if (gutter <= SCROLLBAR_MAX) {
      width -= gutter;
    }
  }
  return {
    width,
    height,
    x: x2,
    y: y3
  };
}
function getInnerBoundingClientRect(element, strategy) {
  const clientRect = getBoundingClientRect(element, true, strategy === "fixed");
  const top = clientRect.top + element.clientTop;
  const left = clientRect.left + element.clientLeft;
  const scale = getScale(element);
  const width = element.clientWidth * scale.x;
  const height = element.clientHeight * scale.y;
  const x2 = left * scale.x;
  const y3 = top * scale.y;
  return {
    width,
    height,
    x: x2,
    y: y3
  };
}
function getClientRectFromClippingAncestor(element, clippingAncestor, strategy) {
  let rect;
  if (clippingAncestor === "viewport" || clippingAncestor === "layoutViewport") {
    rect = getViewportRect(element, strategy, clippingAncestor);
  } else if (clippingAncestor === "document") {
    rect = getDocumentRect(getDocumentElement(element));
  } else if (isElement(clippingAncestor)) {
    rect = getInnerBoundingClientRect(clippingAncestor, strategy);
  } else {
    const visualOffsets = getVisualOffsets(element);
    rect = {
      x: clippingAncestor.x - visualOffsets.x,
      y: clippingAncestor.y - visualOffsets.y,
      width: clippingAncestor.width,
      height: clippingAncestor.height
    };
  }
  return rectToClientRect(rect);
}
function getClippingElementAncestors(element, cache) {
  const cachedResult = cache.get(element);
  if (cachedResult) {
    return cachedResult;
  }
  let result = getOverflowAncestors(element, [], false).filter((el) => isElement(el) && getNodeName(el) !== "body");
  let lastKeptComputedStyle = null;
  const elementIsFixed = getComputedStyle2(element).position === "fixed";
  let currentNode = elementIsFixed ? getParentNode(element) : element;
  while (isElement(currentNode) && !isLastTraversableNode(currentNode)) {
    const computedStyle = getComputedStyle2(currentNode);
    const currentNodeIsContaining = isContainingBlock(currentNode);
    const lastPosition = lastKeptComputedStyle ? lastKeptComputedStyle.position : elementIsFixed ? "fixed" : "";
    const shouldDropCurrentNode = !currentNodeIsContaining && (lastPosition === "fixed" || lastPosition === "absolute" && computedStyle.position === "static");
    if (shouldDropCurrentNode) {
      result = result.filter((ancestor) => ancestor !== currentNode);
    } else {
      lastKeptComputedStyle = computedStyle;
    }
    currentNode = getParentNode(currentNode);
  }
  cache.set(element, result);
  return result;
}
function getClippingRect(_ref) {
  let {
    element,
    boundary,
    rootBoundary,
    strategy
  } = _ref;
  const elementClippingAncestors = boundary === "clippingAncestors" ? isTopLayer(element) ? [] : getClippingElementAncestors(element, this._c) : [].concat(boundary);
  const clippingAncestors = [...elementClippingAncestors, rootBoundary];
  const firstRect = getClientRectFromClippingAncestor(element, clippingAncestors[0], strategy);
  let top = firstRect.top;
  let right = firstRect.right;
  let bottom = firstRect.bottom;
  let left = firstRect.left;
  for (let i4 = 1; i4 < clippingAncestors.length; i4++) {
    const rect = getClientRectFromClippingAncestor(element, clippingAncestors[i4], strategy);
    top = max(rect.top, top);
    right = min(rect.right, right);
    bottom = min(rect.bottom, bottom);
    left = max(rect.left, left);
  }
  return {
    width: right - left,
    height: bottom - top,
    x: left,
    y: top
  };
}
function getDimensions(element) {
  const {
    width,
    height
  } = getCssDimensions(element);
  return {
    width,
    height
  };
}
function getRectRelativeToOffsetParent(element, offsetParent, strategy) {
  const isOffsetParentAnElement = isHTMLElement(offsetParent);
  const documentElement = getDocumentElement(offsetParent);
  const isFixed = strategy === "fixed";
  const rect = getBoundingClientRect(element, true, isFixed, offsetParent);
  let scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  const offsets = createCoords(0);
  if (isOffsetParentAnElement || !isFixed) {
    if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isOffsetParentAnElement) {
      const offsetRect = getBoundingClientRect(offsetParent, true, isFixed, offsetParent);
      offsets.x = offsetRect.x + offsetParent.clientLeft;
      offsets.y = offsetRect.y + offsetParent.clientTop;
    }
  }
  if (!isOffsetParentAnElement && documentElement) {
    offsets.x = getWindowScrollBarX(documentElement);
  }
  const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
  const x2 = rect.left + scroll.scrollLeft - offsets.x - htmlOffset.x;
  const y3 = rect.top + scroll.scrollTop - offsets.y - htmlOffset.y;
  return {
    x: x2,
    y: y3,
    width: rect.width,
    height: rect.height
  };
}
function isStaticPositioned(element) {
  return getComputedStyle2(element).position === "static";
}
function getTrueOffsetParent(element, polyfill) {
  if (!isHTMLElement(element) || getComputedStyle2(element).position === "fixed") {
    return null;
  }
  if (polyfill) {
    return polyfill(element);
  }
  let rawOffsetParent = element.offsetParent;
  if (getDocumentElement(element) === rawOffsetParent) {
    rawOffsetParent = rawOffsetParent.ownerDocument.body;
  }
  return rawOffsetParent;
}
function getOffsetParent(element, polyfill) {
  const win = getWindow(element);
  if (isTopLayer(element)) {
    return win;
  }
  if (!isHTMLElement(element)) {
    let svgOffsetParent = getParentNode(element);
    while (svgOffsetParent && !isLastTraversableNode(svgOffsetParent)) {
      if (isElement(svgOffsetParent) && !isStaticPositioned(svgOffsetParent)) {
        return svgOffsetParent;
      }
      svgOffsetParent = getParentNode(svgOffsetParent);
    }
    return win;
  }
  let offsetParent = getTrueOffsetParent(element, polyfill);
  while (offsetParent && isTableElement(offsetParent) && isStaticPositioned(offsetParent)) {
    offsetParent = getTrueOffsetParent(offsetParent, polyfill);
  }
  if (offsetParent && isLastTraversableNode(offsetParent) && isStaticPositioned(offsetParent) && !isContainingBlock(offsetParent)) {
    return win;
  }
  return offsetParent || getContainingBlock(element) || win;
}
var getElementRects = async function(data) {
  const getOffsetParentFn = this.getOffsetParent || getOffsetParent;
  const getDimensionsFn = this.getDimensions;
  const floatingDimensions = await getDimensionsFn(data.floating);
  return {
    reference: getRectRelativeToOffsetParent(data.reference, await getOffsetParentFn(data.floating), data.strategy),
    floating: {
      x: 0,
      y: 0,
      width: floatingDimensions.width,
      height: floatingDimensions.height
    }
  };
};
function isRTL(element) {
  return getComputedStyle2(element).direction === "rtl";
}
var platform = {
  convertOffsetParentRelativeRectToViewportRelativeRect,
  getDocumentElement,
  getClippingRect,
  getOffsetParent,
  getElementRects,
  getClientRects,
  getDimensions,
  getScale,
  isElement,
  isRTL
};
function rectsAreEqual(a3, b2) {
  return a3.x === b2.x && a3.y === b2.y && a3.width === b2.width && a3.height === b2.height;
}
function observeMove(element, onMove, ancestorResize) {
  let io = null;
  let timeoutId;
  const root = getDocumentElement(element);
  function cleanup() {
    var _io;
    clearTimeout(timeoutId);
    (_io = io) == null || _io.disconnect();
    io = null;
  }
  function refresh(skip, threshold) {
    if (skip === void 0) {
      skip = false;
    }
    if (threshold === void 0) {
      threshold = 1;
    }
    cleanup();
    const elementRectForRootMargin = element.getBoundingClientRect();
    const {
      left,
      top,
      width,
      height
    } = elementRectForRootMargin;
    if (!skip) {
      onMove();
    }
    if (!width || !height) {
      return;
    }
    const insetTop = floor(top);
    const insetRight = floor(root.clientWidth - (left + width));
    const insetBottom = floor(root.clientHeight - (top + height));
    const insetLeft = floor(left);
    const rootMargin = -insetTop + "px " + -insetRight + "px " + -insetBottom + "px " + -insetLeft + "px";
    const options = {
      rootMargin,
      threshold: max(0, min(1, threshold)) || 1
    };
    let isFirstUpdate = true;
    function handleObserve(entries) {
      const ratio = entries[0].intersectionRatio;
      if (!rectsAreEqual(elementRectForRootMargin, element.getBoundingClientRect())) {
        return refresh();
      }
      if (ratio !== threshold) {
        if (!isFirstUpdate) {
          return refresh();
        }
        if (!ratio) {
          timeoutId = setTimeout(() => {
            refresh(false, 1e-7);
          }, 1e3);
        } else {
          refresh(false, ratio);
        }
      }
      isFirstUpdate = false;
    }
    try {
      io = new IntersectionObserver(handleObserve, {
        ...options,
        // Handle <iframe>s
        root: root.ownerDocument
      });
    } catch (_e) {
      io = new IntersectionObserver(handleObserve, options);
    }
    io.observe(element);
  }
  const win = getWindow(element);
  const handleResize = () => refresh(ancestorResize);
  win.addEventListener("resize", handleResize);
  refresh(true);
  return () => {
    win.removeEventListener("resize", handleResize);
    cleanup();
  };
}
function autoUpdate(reference, floating, update, options) {
  if (options === void 0) {
    options = {};
  }
  const {
    ancestorScroll = true,
    ancestorResize = true,
    elementResize = typeof ResizeObserver === "function",
    layoutShift = typeof IntersectionObserver === "function",
    animationFrame = false
  } = options;
  const referenceEl = unwrapElement(reference);
  const ancestors = ancestorScroll || ancestorResize ? [...referenceEl ? getOverflowAncestors(referenceEl) : [], ...floating ? getOverflowAncestors(floating) : []] : [];
  ancestors.forEach((ancestor) => {
    ancestorScroll && ancestor.addEventListener("scroll", update);
    ancestorResize && ancestor.addEventListener("resize", update);
  });
  const cleanupIo = referenceEl && layoutShift ? observeMove(referenceEl, update, ancestorResize) : null;
  let reobserveFrame = -1;
  let resizeObserver = null;
  if (elementResize) {
    resizeObserver = new ResizeObserver((_ref) => {
      let [firstEntry] = _ref;
      if (firstEntry && firstEntry.target === referenceEl && resizeObserver && floating) {
        resizeObserver.unobserve(floating);
        cancelAnimationFrame(reobserveFrame);
        reobserveFrame = requestAnimationFrame(() => {
          var _resizeObserver;
          (_resizeObserver = resizeObserver) == null || _resizeObserver.observe(floating);
        });
      }
      update();
    });
    if (referenceEl && !animationFrame) {
      resizeObserver.observe(referenceEl);
    }
    if (floating) {
      resizeObserver.observe(floating);
    }
  }
  let frameId;
  let prevRefRect = animationFrame ? getBoundingClientRect(reference) : null;
  if (animationFrame) {
    frameLoop();
  }
  function frameLoop() {
    const nextRefRect = getBoundingClientRect(reference);
    if (prevRefRect && !rectsAreEqual(prevRefRect, nextRefRect)) {
      update();
    }
    prevRefRect = nextRefRect;
    frameId = requestAnimationFrame(frameLoop);
  }
  update();
  return () => {
    var _resizeObserver2;
    ancestors.forEach((ancestor) => {
      ancestorScroll && ancestor.removeEventListener("scroll", update);
      ancestorResize && ancestor.removeEventListener("resize", update);
    });
    cleanupIo == null || cleanupIo();
    (_resizeObserver2 = resizeObserver) == null || _resizeObserver2.disconnect();
    resizeObserver = null;
    if (animationFrame) {
      cancelAnimationFrame(frameId);
    }
  };
}
var offset2 = offset;
var shift2 = shift;
var flip2 = flip;
var arrow2 = arrow;
var computePosition2 = (reference, floating, options) => {
  const cache = /* @__PURE__ */ new Map();
  const mergedOptions = options != null ? options : {};
  const platformWithCache = {
    ...platform,
    ...mergedOptions.platform,
    _c: cache
  };
  return computePosition(reference, floating, {
    ...mergedOptions,
    platform: platformWithCache
  });
};

// node_modules/@deck.gl/widgets/dist/lib/components/popover.js
var Popover = ({ x: x2, y: y3, placement = "right", offset: pixelOffset = 0, arrow: arrowSize = false, arrowColor = "white", children }) => {
  const anchorRef = A2(null);
  const contentRef = A2(null);
  const arrowRef = A2(null);
  const updaterRef = A2();
  updaterRef.current = () => {
    if (!anchorRef.current || !contentRef.current)
      return;
    const arrowWidth = Array.isArray(arrowSize) ? arrowSize[0] : arrowSize || 0;
    const arrowHeight = Array.isArray(arrowSize) ? arrowSize[1] : arrowSize || 0;
    const padding = pixelOffset + Math.max(arrowHeight, arrowWidth);
    const middleware = placement.includes("-") ? [offset2(padding), flip2(), shift2()] : [offset2(padding), shift2(), flip2()];
    if (arrowRef.current)
      middleware.push(arrow2({ element: arrowRef.current }));
    computePosition2(anchorRef.current, contentRef.current, {
      placement,
      strategy: "fixed",
      middleware
    }).then((popoverPos) => {
      if (contentRef.current) {
        Object.assign(contentRef.current.style, {
          left: `${popoverPos.x}px`,
          top: `${popoverPos.y}px`
        });
      }
      const arrowData = popoverPos.middlewareData.arrow;
      if (arrowData && arrowRef.current) {
        const arrowStyle = createArrow(arrowWidth, arrowHeight, arrowColor, popoverPos.placement);
        arrowStyle.transform = `translate(${arrowData.x || 0}px, ${arrowData.y || 0}px)`;
        Object.assign(arrowRef.current.style, arrowStyle);
      }
    });
  };
  T2(() => {
    var _a;
    (_a = updaterRef.current) == null ? void 0 : _a.call(updaterRef);
  }, [x2, y3, placement, arrowSize, pixelOffset]);
  h2(() => {
    const anchor = anchorRef.current;
    const content = contentRef.current;
    if (!anchor || !content) {
      return void 0;
    }
    content.style.visibility = "visible";
    const cleanup = autoUpdate(anchor, content, () => {
      var _a;
      return (_a = updaterRef.current) == null ? void 0 : _a.call(updaterRef);
    });
    return () => {
      cleanup();
    };
  }, []);
  return u2("div", { style: { position: "absolute", left: x2, top: y3 }, ref: anchorRef, children: u2("div", { className: "deck-widget deck-widget-popover", style: { position: "fixed", visibility: "hidden", pointerEvents: "none" }, ref: contentRef, children: [Boolean(arrowSize) && u2("div", { className: "deck-widget-popover-arrow", style: { position: "absolute" }, ref: arrowRef }), children] }) });
};
function createArrow(width, height, color, placement) {
  const result = {
    width: 0,
    height: 0,
    top: "",
    bottom: "",
    left: "",
    right: ""
  };
  if (placement.startsWith("bottom")) {
    result.borderLeft = `${width / 2}px solid transparent`;
    result.borderRight = `${width / 2}px solid transparent`;
    result.borderBottom = `${height}px solid ${color}`;
    result.borderTop = "";
    result.top = `${-height}px`;
  } else if (placement.startsWith("top")) {
    result.borderLeft = `${width / 2}px solid transparent`;
    result.borderRight = `${width / 2}px solid transparent`;
    result.borderTop = `${height}px solid ${color}`;
    result.borderBottom = "";
    result.bottom = `${-height}px`;
  } else if (placement.startsWith("right")) {
    result.borderTop = `${width / 2}px solid transparent`;
    result.borderBottom = `${width / 2}px solid transparent`;
    result.borderRight = `${height}px solid ${color}`;
    result.borderLeft = "";
    result.left = `${-height}px`;
  } else if (placement.startsWith("left")) {
    result.borderTop = `${width / 2}px solid transparent`;
    result.borderBottom = `${width / 2}px solid transparent`;
    result.borderLeft = `${height}px solid ${color}`;
    result.borderRight = "";
    result.right = `${-height}px`;
  }
  return result;
}

// node_modules/@deck.gl/widgets/dist/lib/components/user-content.js
var UserContent = ({ text, html, element, ...props }) => {
  const containerRef = A2(null);
  h2(() => {
    if (containerRef.current && element) {
      containerRef.current.append(element);
    }
    return () => {
      element == null ? void 0 : element.remove();
    };
  }, [element]);
  return u2("div", { ref: containerRef, ...props, dangerouslySetInnerHTML: html ? { __html: html } : void 0, children: text });
};

// node_modules/@deck.gl/widgets/dist/info-widget.js
var InfoWidget = class extends Widget {
  constructor(props) {
    super(props);
    this.className = "deck-widget-info";
    this.placement = "fill";
    this.tooltip = null;
    this.setProps(this.props);
  }
  setProps(props) {
    this.viewId = props.viewId ?? this.viewId;
    super.setProps(props);
  }
  onAdd({ deck }) {
    this.deck = deck;
  }
  onRemove() {
    if (this.rootElement) {
      R(null, this.rootElement);
    }
  }
  onViewportChange(viewport) {
    this.viewport = viewport;
    this.updateHTML();
  }
  onHover(info) {
    if (this.props.mode === "hover") {
      this.tooltip = this._getTooltip(info);
      this.updateHTML();
    }
  }
  onClick(info) {
    if (this.props.mode === "click") {
      this.tooltip = this._getTooltip(info);
      this.updateHTML();
    }
  }
  _getTooltip(info) {
    if (!this.props.getTooltip)
      return null;
    const content = this.props.getTooltip(info, this) ?? null;
    if (content === null)
      return null;
    const normalizedTooltip = typeof content === "string" ? { text: content } : content;
    const position = normalizedTooltip.position || info.coordinate;
    if (!position)
      return null;
    return {
      position,
      text: "",
      html: "",
      element: null,
      className: "",
      style: {},
      ...normalizedTooltip
    };
  }
  onRenderHTML(rootElement) {
    if (!this.viewport || this.tooltip === null) {
      R(null, rootElement);
      return;
    }
    const style = {
      ...this.props.style,
      ...this.tooltip.style
    };
    const [x2, y3] = this.viewport.project(this.tooltip.position);
    const ui = u2(Popover, { x: x2, y: y3, placement: this.props.placement, arrow: this.props.arrow, arrowColor: "var(--menu-background, #fff)", offset: this.props.offset, children: u2(UserContent, { className: `deck-widget-popup-content ${this.tooltip.className} ${this.props.className}`, style, html: this.tooltip.html, text: this.tooltip.text, element: this.tooltip.element }) });
    R(ui, rootElement);
  }
};
InfoWidget.defaultProps = {
  ...Widget.defaultProps,
  id: "info",
  viewId: null,
  mode: "hover",
  getTooltip: void 0,
  placement: "right",
  offset: 10,
  arrow: 10
};

// node_modules/@deck.gl/widgets/dist/popup-widget.js
var PopupWidget = class extends Widget {
  constructor(props) {
    super(props);
    this.className = "deck-widget-popup";
    this.placement = "fill";
    this.setProps(this.props);
    this.isOpen = this.props.defaultIsOpen;
  }
  setProps(props) {
    this.viewId = props.viewId ?? this.viewId;
    super.setProps(props);
  }
  onAdd({ deck }) {
    this.deck = deck;
  }
  onRemove() {
    if (this.rootElement) {
      R(null, this.rootElement);
    }
  }
  onViewportChange(viewport) {
    this.viewport = viewport;
    this.updateHTML();
  }
  onClick() {
    if (this.props.closeOnClickOutside) {
      this._setIsOpen(false);
    }
  }
  _setIsOpen(isOpen) {
    var _a, _b;
    if (this.isOpen === isOpen)
      return;
    this.isOpen = isOpen;
    (_b = (_a = this.props).onOpenChange) == null ? void 0 : _b.call(_a, isOpen);
    this.updateHTML();
  }
  onRenderHTML(rootElement) {
    if (!this.viewport) {
      R(null, rootElement);
      return;
    }
    const { marker, content, style } = this.props;
    const [x2, y3] = this.viewport.project(this.props.position);
    const ui = u2("div", { children: [marker && u2("div", { className: "deck-widget-popup-marker", style: { left: x2, top: y3 }, children: u2(UserContent, { ...marker, onClick: () => this._setIsOpen(true) }) }), this.isOpen && u2(Popover, { x: x2, y: y3, placement: this.props.placement, arrow: this.props.arrow, arrowColor: "var(--menu-background, #fff)", offset: this.props.offset, children: u2("div", { className: `deck-widget-popup-content ${this.props.className}`, style, children: [this.props.closeButton && u2("div", { className: "deck-widget-popup-controls", style: { width: "100%", display: "flex", justifyContent: "end" }, children: u2(IconButton, { className: "deck-widget-popup-close-button", onClick: () => this._setIsOpen(false) }) }), u2(UserContent, { ...typeof content === "string" ? { text: content } : content })] }) })] });
    R(ui, rootElement);
  }
};
PopupWidget.defaultProps = {
  ...Widget.defaultProps,
  id: "info",
  viewId: null,
  position: [0, 0],
  marker: null,
  defaultIsOpen: true,
  content: "",
  placement: "right",
  offset: 10,
  arrow: 10,
  closeButton: true,
  closeOnClickOutside: false,
  onOpenChange: () => {
  }
};

// node_modules/@deck.gl/widgets/dist/context-menu-widget.js
var ContextMenuWidget = class extends Widget {
  constructor(props) {
    super(props);
    this.className = "deck-widget-context-menu";
    this.placement = "fill";
    this.menu = null;
    this.setProps(this.props);
  }
  onAdd({ deck }) {
    var _a;
    (_a = deck.getCanvas()) == null ? void 0 : _a.addEventListener("contextmenu", (event) => this.handleContextMenu(event));
  }
  handleContextMenu(srcEvent) {
    var _a, _b, _c;
    const targetRect = srcEvent.target.getBoundingClientRect();
    const x2 = srcEvent.clientX - targetRect.x;
    const y3 = srcEvent.clientY - targetRect.y;
    const pickInfo = ((_a = this.deck) == null ? void 0 : _a.pickObject({ x: x2, y: y3 })) || {
      x: x2,
      y: y3,
      picked: false,
      layer: null,
      color: null,
      index: -1,
      pixelRatio: 1
    };
    const menuItems = ((_c = (_b = this.props).getMenuItems) == null ? void 0 : _c.call(_b, pickInfo, this)) || this.props.menuItems;
    this.menu = menuItems.length > 0 ? {
      items: menuItems,
      pickInfo
    } : null;
    srcEvent.preventDefault();
    this.updateHTML();
  }
  onRenderHTML(rootElement) {
    if (!this.menu) {
      R(null, rootElement);
      return;
    }
    const { items, pickInfo } = this.menu;
    const style = {
      pointerEvents: "auto",
      position: "static",
      ...this.props.style
    };
    const ui = u2(Popover, { x: pickInfo.x, y: pickInfo.y, placement: this.props.placement, arrow: this.props.arrow, arrowColor: "var(--menu-background, #fff)", offset: this.props.offset, children: u2(SimpleMenu, { menuItems: items, onSelect: (value) => this.props.onMenuItemSelected(value, pickInfo), style, isOpen: true, onClose: () => this.hide() }) });
    R(ui, rootElement);
  }
  hide() {
    this.menu = null;
    this.updateHTML();
  }
};
ContextMenuWidget.defaultProps = {
  ...Widget.defaultProps,
  id: "context",
  viewId: null,
  menuItems: [],
  getMenuItems: void 0,
  onMenuItemSelected: () => {
  },
  placement: "bottom-start",
  offset: 10,
  arrow: false
};

// node_modules/@deck.gl/widgets/dist/lib/components/range-input.js
var wheelListenerOptions = { passive: false };
var clamp3 = (value, min2, max2) => {
  if (value < min2) {
    return min2;
  }
  if (value > max2) {
    return max2;
  }
  return value;
};
var getTrackDimension = (track, vertical) => {
  if (!track || !track.firstElementChild) {
    return [0, 0];
  }
  const rect = track.firstElementChild.getBoundingClientRect();
  if (vertical) {
    return [rect.top, rect.height];
  }
  return vertical ? [rect.top, rect.height] : [rect.left, rect.width];
};
var getEffectiveStep = (step, range) => {
  if (typeof step === "number" && !Number.isNaN(step) && step > 0) {
    return step;
  }
  return Math.max(1, range / 10 || 1);
};
var getEffectivePage = (pageSize, rangeSize) => {
  if (typeof pageSize === "number" && !Number.isNaN(pageSize) && pageSize > 0) {
    return pageSize;
  }
  return Math.max(1, rangeSize || 1);
};
function RangeInput(props) {
  const { className = "", min: min2, max: max2, step, value, orientation, pageSize, stepButtons = false, startButtonAriaLabel, endButtonAriaLabel, eventTarget, decorations = [], onChange } = props;
  const vertical = orientation !== "horizontal";
  const rootRef = A2(null);
  const trackRef = A2(null);
  const thumbRef = A2(null);
  const dragStateRef = A2(null);
  const [trackLength, setTrackLength] = d2(0);
  const range = max2 - min2;
  const rangeSize = Math.max(0, value[1] - value[0]);
  const maxStart = Math.max(0, range - rangeSize);
  const clampedStart = clamp3(value[0], min2, min2 + maxStart);
  const { thumbLength, thumbOffset } = T2(() => {
    if (trackLength <= 0 || range <= 0) {
      return { thumbLength: 0, thumbOffset: 0 };
    }
    if (range <= rangeSize) {
      return { thumbLength: 1, thumbOffset: 0 };
    }
    const nextThumbLength = rangeSize / range;
    const travel = Math.max(0, 1 - nextThumbLength);
    const ratio = maxStart <= 0 ? 0 : clamp3((clampedStart - min2) / maxStart, 0, 1);
    return {
      thumbLength: Math.max(0, Math.min(nextThumbLength, 1)),
      thumbOffset: travel * ratio
    };
  }, [trackLength, range, rangeSize, maxStart, clampedStart, min2]);
  const emitRange = q2((nextStart) => {
    if (!onChange) {
      return;
    }
    const clamped = clamp3(nextStart, min2, min2 + maxStart);
    onChange([clamped, clamped + rangeSize]);
  }, [onChange, min2, maxStart, rangeSize]);
  const handleStepNegative = q2((event) => {
    event.stopPropagation();
    emitRange(clampedStart - getEffectiveStep(step, range));
  }, [emitRange, clampedStart, step, range]);
  const handleStepPositive = q2((event) => {
    event.stopPropagation();
    emitRange(clampedStart + getEffectiveStep(step, range));
  }, [emitRange, clampedStart, step, range]);
  const handleTrackClick = q2((event) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target;
    if ((target == null ? void 0 : target.dataset.scrollbarThumb) === "true") {
      return;
    }
    const track = trackRef.current;
    if (!track) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const [trackStart] = getTrackDimension(track, vertical);
    const coordinate = vertical ? event.clientY - trackStart : event.clientX - trackStart;
    const span = Math.max(1, 1 - thumbLength) * trackLength;
    const thumbCenter = thumbLength / 2 * trackLength;
    const ratio = span <= 0 ? 0 : clamp3((coordinate - thumbCenter) / span, 0, 1);
    emitRange(min2 + ratio * maxStart);
  }, [vertical, trackLength, thumbLength, emitRange, min2, maxStart]);
  const handleThumbPointerDown = (event) => {
    if (event.button !== 0) {
      return;
    }
    const track = trackRef.current;
    if (!track) {
      return;
    }
    dragStateRef.current = {
      pointerId: event.pointerId,
      startCoord: vertical ? event.clientY : event.clientX,
      startRatio: thumbOffset,
      min: min2,
      max: max2,
      maxStart
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };
  const handleThumbPointerMove = q2((event) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }
    const [trackStart, trackLength2] = getTrackDimension(trackRef.current, vertical);
    const coordinate = vertical ? event.clientY : event.clientX;
    const delta = coordinate - state.startCoord;
    const ratio = state.startRatio + delta / trackLength2;
    const nextStart = clamp3(ratio * (state.max - state.min), 0, state.maxStart) + state.min;
    emitRange(nextStart);
    event.preventDefault();
  }, [emitRange, vertical]);
  const handleThumbPointerUp = q2((event) => {
    var _a;
    const state = dragStateRef.current;
    if (state && state.pointerId === event.pointerId) {
      dragStateRef.current = null;
      (_a = thumbRef.current) == null ? void 0 : _a.releasePointerCapture(event.pointerId);
      event.preventDefault();
    }
  }, []);
  const handleKeyDown = q2((event) => {
    switch (event.key) {
      case "ArrowUp":
      case "ArrowLeft":
        if (vertical && event.key === "ArrowUp" || !vertical && event.key === "ArrowLeft") {
          emitRange(clampedStart - getEffectiveStep(step, range));
          event.preventDefault();
        }
        break;
      case "ArrowDown":
      case "ArrowRight":
        if (vertical && event.key === "ArrowDown" || !vertical && event.key === "ArrowRight") {
          emitRange(clampedStart + getEffectiveStep(step, range));
          event.preventDefault();
        }
        break;
      case "PageUp":
        emitRange(clampedStart - getEffectivePage(pageSize, rangeSize));
        event.preventDefault();
        break;
      case "PageDown":
        emitRange(clampedStart + getEffectivePage(pageSize, rangeSize));
        event.preventDefault();
        break;
      case "Home":
        emitRange(min2);
        event.preventDefault();
        break;
      case "End":
        emitRange(min2 + maxStart);
        event.preventDefault();
        break;
      default:
        break;
    }
  }, [vertical, emitRange, clampedStart, step, range, pageSize, rangeSize, min2, maxStart]);
  const handleWheel = q2((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (maxStart === 0) {
      return;
    }
    let delta = vertical ? event.deltaY : event.deltaX;
    if (!vertical && delta === 0) {
      delta = event.deltaY;
    }
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      delta *= getEffectiveStep(step, range);
    } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      delta *= getEffectivePage(pageSize, rangeSize);
    }
    if (delta === 0) {
      return;
    }
    emitRange(clampedStart + delta);
  }, [emitRange, clampedStart, maxStart, vertical, step, range, pageSize, rangeSize]);
  _2(() => {
    setTrackLength(getTrackDimension(trackRef.current, vertical)[1]);
  }, [vertical]);
  _2(() => {
    const track = trackRef.current;
    if (!track) {
      return void 0;
    }
    const update = () => {
      setTrackLength(getTrackDimension(track, vertical)[1]);
    };
    update();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(update);
      observer.observe(track);
      return () => observer.disconnect();
    }
    if (typeof window !== "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    return void 0;
  }, [vertical]);
  h2(() => {
    const eventRoot = eventTarget ?? rootRef.current;
    if (!eventRoot)
      return void 0;
    eventRoot.addEventListener("keydown", handleKeyDown);
    eventRoot.addEventListener("wheel", handleWheel, wheelListenerOptions);
    return () => {
      eventRoot.removeEventListener("keydown", handleKeyDown);
      eventRoot.removeEventListener("wheel", handleWheel, wheelListenerOptions);
    };
  }, [eventTarget, handleKeyDown, handleWheel]);
  const decorationElements = T2(() => {
    if (!decorations.length || range <= 0) {
      return [];
    }
    return decorations.map((decoration, index) => {
      const [start, end] = decoration.position;
      const startRatio = (start - min2) / range;
      const endRatio = (end - min2) / range;
      const offsetPct = Math.round(startRatio * 1e3) / 10;
      const sizePct = Math.max(0, Math.round((endRatio - startRatio) * 1e3) / 10);
      const style = vertical ? {
        left: "0",
        width: "100%",
        top: `${offsetPct}%`,
        height: `${sizePct}%`
      } : {
        top: "0",
        height: "100%",
        left: `${offsetPct}%`,
        width: `${sizePct}%`
      };
      return u2("div", { className: "deck-widget-range__decoration", style, children: decoration.element }, `decoration-${index}`);
    });
  }, [decorations, range, min2, vertical]);
  return u2("div", { ref: rootRef, tabIndex: 0, role: "scrollbar", "aria-valuemin": min2, "aria-valuemax": min2 + maxStart, "aria-valuenow": clampedStart, "aria-orientation": orientation, className: `${className} deck-widget-range deck-widget-range--${orientation} ${maxStart === 0 ? "deck-widget-range--disabled" : ""}`, children: [stepButtons && u2("button", { type: "button", className: "deck-widget-range__button deck-widget-range__button--start", "aria-label": startButtonAriaLabel, disabled: clampedStart <= min2, onClick: handleStepNegative, children: u2("span", { className: "deck-widget-icon" }) }), u2("div", { className: "deck-widget-range__track", ref: trackRef, onClick: handleTrackClick, children: [u2("div", { className: "deck-widget-range__decorations", children: decorationElements }), u2("div", { className: "deck-widget-range__thumb", "data-scrollbar-thumb": "true", ref: thumbRef, style: vertical ? { height: `${thumbLength * 100}%`, top: `${thumbOffset * 100}%` } : { width: `${thumbLength * 100}%`, left: `${thumbOffset * 100}%` }, onPointerDown: handleThumbPointerDown, onPointerMove: handleThumbPointerMove, onPointerUp: handleThumbPointerUp, onPointerCancel: handleThumbPointerUp })] }), stepButtons && u2("button", { type: "button", className: "deck-widget-range__button deck-widget-range__button--end", "aria-label": endButtonAriaLabel, disabled: clampedStart >= min2 + maxStart, onClick: handleStepPositive, children: u2("span", { className: "deck-widget-icon" }) })] });
}

// node_modules/@deck.gl/widgets/dist/scrollbar-widget.js
var clamp4 = (value, min2, max2) => {
  if (value < min2) {
    return min2;
  }
  if (value > max2) {
    return max2;
  }
  return value;
};
var ScrollbarWidget = class _ScrollbarWidget extends Widget {
  constructor(props) {
    const resolved = {
      ..._ScrollbarWidget.defaultProps,
      ...props
    };
    super(resolved);
    this.className = "deck-widget-scrollbar";
    this.placement = "fill";
    this.contentSize = 0;
    this.viewportSize = 0;
    this.scrollOffset = 0;
    this.handleRangeChange = (nextValue) => {
      this.emitScroll(nextValue[0]);
    };
    this.viewId = resolved.viewId ?? null;
  }
  onViewportChange(viewport) {
    this.viewport = viewport;
    this.onRenderHTML();
  }
  onRenderHTML() {
    const element = this.rootElement;
    if (!element) {
      return;
    }
    element.dataset.placement = this.props.placement;
    const viewport = this.viewport;
    this.updateViewport(viewport);
    const clampedOffset = this.getClampedOffset();
    const wheelTarget = this.getWheelEventTarget(this.props.captureWheel ? "global" : "local");
    const decorations = this.getDecorations(viewport);
    const isVertical = this.isVertical();
    const startLabel = this.props.startButtonAriaLabel ?? (isVertical ? "Scroll up" : "Scroll left");
    const endLabel = this.props.endButtonAriaLabel ?? (isVertical ? "Scroll down" : "Scroll right");
    const ui = u2(RangeInput, { min: 0, max: Math.max(0, this.contentSize), step: this.getEffectiveStep(), pageSize: this.getEffectivePage(), value: [clampedOffset, clampedOffset + this.viewportSize], orientation: this.props.orientation, stepButtons: true, startButtonAriaLabel: startLabel, endButtonAriaLabel: endLabel, eventTarget: wheelTarget, decorations, onChange: this.handleRangeChange });
    R(ui, element);
  }
  onRemove() {
    if (this.rootElement) {
      R(null, this.rootElement);
    }
    super.onRemove();
  }
  getContentBounds(viewId) {
    var _a, _b, _c;
    return this.props.contentBounds ?? ((_c = (_b = (_a = this.deck) == null ? void 0 : _a.getView(viewId)) == null ? void 0 : _b.controller) == null ? void 0 : _c.maxBounds) ?? null;
  }
  updateViewport(viewport) {
    if (!viewport) {
      this.contentSize = 0;
      this.scrollOffset = 0;
      this.viewportSize = 0;
      return;
    }
    const contentBounds = this.getContentBounds(viewport.id);
    const isVertical = this.isVertical();
    const projectedBounds = contentBounds ? projectBounds(contentBounds, viewport, isVertical) : [0, 0];
    this.contentSize = projectedBounds[1] - projectedBounds[0];
    this.scrollOffset = -projectedBounds[0];
    this.viewportSize = isVertical ? viewport.height : viewport.width;
  }
  getDecorations(viewport) {
    const { decorations = [] } = this.props;
    if (!viewport || decorations.length === 0) {
      return [];
    }
    const contentBounds = this.getContentBounds(viewport.id);
    if (!contentBounds) {
      return [];
    }
    const isVertical = this.isVertical();
    const [contentStart] = projectBounds(contentBounds, viewport, isVertical);
    return decorations.map((decoration) => {
      const [start, end] = projectBounds(decoration.contentBounds, viewport, isVertical);
      const onClick = decoration.onClick ? (e3) => {
        var _a;
        const handled = (_a = decoration.onClick) == null ? void 0 : _a.call(decoration, e3);
        if (handled) {
          e3.stopPropagation();
          e3.preventDefault();
        }
      } : void 0;
      return {
        position: [start - contentStart, end - contentStart],
        element: u2("div", { style: {
          pointerEvents: onClick ? "all" : "none",
          width: "100%",
          height: "100%",
          backgroundColor: decoration.color
        }, title: decoration.title, onClick })
      };
    });
  }
  getWheelEventTarget(mode) {
    var _a, _b, _c;
    if (mode === null)
      return null;
    if (mode === "local")
      return this.rootElement;
    return ((_a = this.deck) == null ? void 0 : _a.props.parent) || ((_c = (_b = this.deck) == null ? void 0 : _b.getCanvas()) == null ? void 0 : _c.parentElement) || this.rootElement;
  }
  getMaxScroll() {
    return Math.max(0, this.contentSize - this.viewportSize);
  }
  getClampedOffset() {
    const maxScroll = this.getMaxScroll();
    return clamp4(this.scrollOffset, 0, maxScroll);
  }
  isVertical() {
    return this.props.orientation !== "horizontal";
  }
  getEffectiveStep() {
    if (typeof this.props.stepSize === "number" && !Number.isNaN(this.props.stepSize)) {
      return this.props.stepSize;
    }
    return Math.max(1, this.viewportSize / 10 || 1);
  }
  getEffectivePage() {
    if (typeof this.props.pageSize === "number" && !Number.isNaN(this.props.pageSize)) {
      return this.props.pageSize;
    }
    return this.viewportSize;
  }
  emitScroll(next) {
    const maxScroll = this.getMaxScroll();
    const target = clamp4(Math.round(next), 0, maxScroll);
    const viewport = this.viewport;
    if (viewport && target !== this.getClampedOffset()) {
      const pixel = viewport.project(viewport.position);
      if (this.isVertical()) {
        pixel[1] -= target - this.scrollOffset;
      } else {
        pixel[0] -= target - this.scrollOffset;
      }
      const { target: newTarget } = viewport.panByPosition(viewport.position, pixel);
      this.deck._onViewStateChange({
        viewId: viewport.id,
        viewState: {
          ...this.getViewState(viewport.id),
          target: newTarget
        },
        interactionState: {}
      });
    }
  }
};
ScrollbarWidget.defaultProps = {
  ...Widget.defaultProps,
  contentBounds: null,
  placement: "top-right",
  viewId: null,
  orientation: "vertical",
  stepSize: null,
  pageSize: null,
  startButtonAriaLabel: "",
  endButtonAriaLabel: "",
  captureWheel: false,
  decorations: []
};
function projectBounds(bounds, viewport, isVertical) {
  return bounds.map(([x2, y3]) => viewport.project([x2, y3, 0])).reduce((range, [x2, y3]) => {
    const value = isVertical ? y3 : x2;
    range[0] = Math.min(range[0], value);
    range[1] = Math.max(range[1], value);
    return range;
  }, [Infinity, -Infinity]);
}

// node_modules/@deck.gl/widgets/dist/icon-widget.js
var IconWidget = class extends Widget {
  constructor(props) {
    super(props);
    this.className = "";
    this.placement = "top-left";
    this.setProps(this.props);
  }
  setProps(props) {
    this.placement = props.placement ?? this.placement;
    this.viewId = props.viewId;
    super.setProps(props);
  }
  onRenderHTML(rootElement) {
    const { className, style, icon, color, label, onClick } = this.props;
    R(u2(IconButton, { className, style, color, icon, label, onClick }), rootElement);
  }
};
IconWidget.defaultProps = {
  ...Widget.defaultProps,
  id: "icon",
  placement: "top-left",
  viewId: null,
  icon: "",
  label: "",
  color: "",
  onClick: void 0
};

// node_modules/@deck.gl/widgets/dist/toggle-widget.js
var ToggleWidget = class extends Widget {
  constructor(props) {
    super(props);
    this.className = "deck-widget-toggle";
    this.placement = "top-left";
    this._toggle = () => {
      var _a, _b;
      this.checked = !this.checked;
      (_b = (_a = this.props).onChange) == null ? void 0 : _b.call(_a, this.checked);
      this.updateHTML();
    };
    this.checked = this.props.initialChecked;
    this.setProps(this.props);
  }
  setProps(props) {
    this.placement = props.placement ?? this.placement;
    this.viewId = props.viewId;
    super.setProps(props);
  }
  onRenderHTML(rootElement) {
    const { className, style, icon, label, color, onIcon = icon, onLabel = label, onColor = color } = this.props;
    const on = this.checked;
    rootElement.dataset.checked = String(on);
    R(u2(IconButton, { className, style, icon: on ? onIcon : icon, label: on ? onLabel : label, color: on ? onColor : color, onClick: this._toggle }), rootElement);
  }
};
ToggleWidget.defaultProps = {
  ...Widget.defaultProps,
  id: "icon",
  placement: "top-left",
  viewId: null,
  initialChecked: false,
  icon: "",
  onIcon: void 0,
  label: "",
  onLabel: void 0,
  color: "",
  onColor: void 0,
  onChange: void 0
};

// node_modules/@deck.gl/widgets/dist/selector-widget.js
var SelectorWidget = class extends Widget {
  constructor(props) {
    super(props);
    this.className = "deck-widget-selector";
    this.placement = "top-left";
    this.isOpen = false;
    this._toggleMenu = () => {
      if (this.isOpen) {
        this.isOpen = false;
      } else if (this.rootElement) {
        this.isOpen = {
          x: this.rootElement.offsetLeft,
          y: this.rootElement.offsetTop,
          placement: this.props.placement.includes("right") ? "left-start" : "right-start"
        };
      }
      this.updateHTML();
    };
    this._handleSelectMode = (value) => {
      this.value = value;
      this.props.onChange(value);
      this.updateHTML();
    };
    this.value = this.props.initialValue;
    this.setProps(this.props);
  }
  setProps(props) {
    this.placement = props.placement ?? this.placement;
    this.viewId = props.viewId ?? this.viewId;
    super.setProps(props);
  }
  onRenderHTML(rootElement) {
    const selectedOption = this.props.options.find((opt) => opt.value === this.value) ?? this.props.options[0];
    R(u2("div", { children: [u2(IconButton, { icon: selectedOption.icon, label: selectedOption.label, onClick: this._toggleMenu }), this.isOpen && u2(Popover, { ...this.isOpen, children: u2(SimpleMenu, { isOpen: true, style: { pointerEvents: "auto", position: "static" }, menuItems: this.props.options, onSelect: this._handleSelectMode, onClose: this._toggleMenu }) })] }), rootElement);
  }
};
SelectorWidget.defaultProps = {
  ...Widget.defaultProps,
  id: "view-selector",
  placement: "top-left",
  viewId: null,
  initialValue: "",
  options: [],
  onChange: () => {
  }
};

// node_modules/@deck.gl/widgets/dist/timeline-widget.js
var TimelineWidget = class extends Widget {
  /**
   * Returns the current time value.
   * In controlled mode, returns the time prop.
   * In uncontrolled mode, returns the internal state.
   */
  getTime() {
    return this.props.time ?? this.currentTime;
  }
  /**
   * Returns the current playing state.
   * In controlled mode, returns the playing prop.
   * In uncontrolled mode, returns the internal state.
   */
  getPlaying() {
    return this.props.playing ?? this._playing;
  }
  constructor(props = {}) {
    var _a;
    super(props);
    this.id = "timeline";
    this.className = "deck-widget-timeline";
    this.placement = "fill";
    this._playing = false;
    this.timerId = null;
    this.handlePlayPause = () => {
      var _a2, _b;
      const isPlaying = this.getPlaying();
      const nextPlaying = !isPlaying;
      (_b = (_a2 = this.props).onPlayingChange) == null ? void 0 : _b.call(_a2, nextPlaying);
      if (this.props.playing === void 0) {
        if (nextPlaying) {
          this.play();
        } else {
          this.stop();
        }
      }
    };
    this.handleTimeChange = ([value]) => {
      var _a2;
      this.props.onTimeChange(value);
      if (this.props.time === void 0) {
        this.currentTime = value;
        (_a2 = this.props.timeline) == null ? void 0 : _a2.setTime(value);
        this.updateHTML();
      }
    };
    this.tick = () => {
      var _a2, _b, _c;
      const { timeRange: [min2, max2], step, loop } = this.props;
      if (step > 0) {
        const currentTime = this.getTime();
        let next = Math.round(currentTime / step) * step + step;
        if (next > max2) {
          if (currentTime < max2) {
            next = max2;
          } else if (loop) {
            next = min2;
          } else {
            next = max2;
            this._playing = false;
            (_b = (_a2 = this.props).onPlayingChange) == null ? void 0 : _b.call(_a2, false);
          }
        }
        this.props.onTimeChange(next);
        if (this.props.time === void 0) {
          this.currentTime = next;
          (_c = this.props.timeline) == null ? void 0 : _c.setTime(next);
        }
        this.updateHTML();
      }
      if (this._playing) {
        this.timerId = window.setTimeout(this.tick, this.props.playInterval);
      } else {
        this.timerId = null;
      }
    };
    this.currentTime = this.props.initialTime ?? this.props.timeRange[0];
    const syncTime = this.props.time ?? this.currentTime;
    (_a = this.props.timeline) == null ? void 0 : _a.setTime(syncTime);
    this.setProps(this.props);
  }
  setProps(props) {
    var _a;
    const { playing: prevPlaying, time: prevTime } = this.props;
    this.viewId = props.viewId ?? this.viewId;
    super.setProps(props);
    if (props.time !== void 0 && props.time !== prevTime) {
      (_a = this.props.timeline) == null ? void 0 : _a.setTime(props.time);
    }
    if (props.playing !== void 0 && props.playing !== prevPlaying) {
      if (props.playing && !this._playing) {
        this._startTimer();
      } else if (!props.playing && this._playing) {
        this._stopTimer();
      }
    }
  }
  onAdd() {
    var _a, _b;
    this._playing = false;
    this.timerId = null;
    if (this.props.autoPlay) {
      if (this.props.playing !== void 0) {
        (_b = (_a = this.props).onPlayingChange) == null ? void 0 : _b.call(_a, true);
      } else {
        this.play();
      }
    }
  }
  onRemove() {
    this.stop();
  }
  onRenderHTML(rootElement) {
    const { timeRange, step, formatLabel } = this.props;
    const isPlaying = this.getPlaying();
    const currentTime = this.getTime();
    rootElement.dataset.placement = this.props.placement;
    R(u2("div", { className: "deck-widget-button-group", children: [isPlaying ? u2(IconButton, { label: "Pause", className: "deck-widget-timeline-pause", onClick: this.handlePlayPause }) : u2(IconButton, { label: "Play", className: "deck-widget-timeline-play", onClick: this.handlePlayPause }), u2(RangeInput, { min: timeRange[0], max: timeRange[1], orientation: "horizontal", step, value: [currentTime, currentTime], onChange: this.handleTimeChange, decorations: [
      {
        position: [currentTime, currentTime + step],
        element: u2("div", { className: "deck-widget-timeline-label deck-widget-timeline-label--current", children: formatLabel(currentTime) })
      }
    ] })] }), rootElement);
  }
  play() {
    var _a;
    this._playing = true;
    const { timeRange: [min2, max2] } = this.props;
    if (this.props.time === void 0 && this.getTime() >= max2) {
      this.currentTime = min2;
      this.props.onTimeChange(min2);
      (_a = this.props.timeline) == null ? void 0 : _a.setTime(min2);
    }
    this.updateHTML();
    this.tick();
  }
  stop() {
    this._stopTimer();
    this.updateHTML();
  }
  /** Start the playback timer (used internally) */
  _startTimer() {
    this._playing = true;
    this.tick();
  }
  /** Stop the playback timer (used internally) */
  _stopTimer() {
    this._playing = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
};
TimelineWidget.defaultProps = {
  ...Widget.defaultProps,
  id: "timeline",
  placement: "bottom-left",
  viewId: null,
  timeline: null,
  timeRange: [0, 100],
  step: 1,
  initialTime: void 0,
  time: void 0,
  onTimeChange: () => {
  },
  autoPlay: false,
  loop: false,
  playInterval: 1e3,
  playing: void 0,
  onPlayingChange: () => {
  },
  formatLabel: String
};

// node_modules/@deck.gl/widgets/dist/screenshot-widget.js
var ScreenshotWidget = class extends Widget {
  constructor(props = {}) {
    super(props);
    this.className = "deck-widget-screenshot";
    this.placement = "top-left";
    this.setProps(this.props);
  }
  setProps(props) {
    this.placement = props.placement ?? this.placement;
    this.viewId = props.viewId ?? this.viewId;
    super.setProps(props);
  }
  onRenderHTML(rootElement) {
    R(u2(IconButton, { className: "deck-widget-camera", label: this.props.label, onClick: this.handleClick.bind(this) }), rootElement);
  }
  handleClick() {
    if (this.props.onCapture) {
      this.props.onCapture(this);
      return;
    }
    const dataURL = this.captureScreenToDataURL(this.props.imageFormat);
    if (dataURL) {
      this.downloadDataURL(dataURL, this.props.filename);
    }
  }
  /** @note only captures canvas contents, not HTML DOM or CSS styles */
  captureScreenToDataURL(imageFormat) {
    var _a;
    const canvas = (_a = this.deck) == null ? void 0 : _a.getCanvas();
    return canvas == null ? void 0 : canvas.toDataURL(imageFormat);
  }
  /** Download a data URL */
  downloadDataURL(dataURL, filename) {
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = filename;
    link.click();
  }
};
ScreenshotWidget.defaultProps = {
  ...Widget.defaultProps,
  id: "screenshot",
  placement: "top-left",
  viewId: null,
  label: "Screenshot",
  filename: "screenshot.png",
  imageFormat: "image/png",
  onCapture: void 0
};

// node_modules/@deck.gl/widgets/dist/themes.js
var LightGlassTheme = {
  "--widget-margin": "12px",
  "--button-size": "28px",
  "--button-corner-radius": "8px",
  "--button-background": "rgba(255, 255, 255, 0.6)",
  "--button-stroke": "rgba(255, 255, 255, 0.3)",
  "--button-inner-stroke": "1px solid rgba(255, 255, 255, 0.6)",
  "--button-shadow": "0px 0px 8px 0px rgba(0, 0, 0, 0.25), 0px 0px 8px 0px rgba(0, 0, 0, 0.1) inset",
  "--button-backdrop-filter": "blur(4px)",
  "--button-icon-idle": "rgba(97, 97, 102, 1)",
  "--button-icon-hover": "rgba(24, 24, 26, 1)",
  "--button-text": "rgb(24, 24, 26, 1)",
  "--icon-compass-north-color": "rgb(240, 92, 68)",
  "--icon-compass-south-color": "rgb(204, 204, 204)",
  "--menu-gap": "4px",
  "--menu-background": "rgba(255, 255, 255, 0.6)",
  "--menu-backdrop-filter": "blur(4px)",
  "--menu-border": "1px solid rgba(255, 255, 255, 0.6)",
  "--menu-shadow": "0px 0px 8px 0px rgba(0, 0, 0, 0.25), 0px 0px 8px 0px rgba(0, 0, 0, 0.1) inset",
  "--menu-text": "rgb(24, 24, 26, 1)",
  "--menu-item-hover": "rgba(0, 0, 0, 0.08)",
  "--range-step-button-size": "24px",
  "--range-track-size": "16px",
  "--range-thumb-size": "10px",
  "--range-track-color": "rgba(215, 214, 229, 0.3)",
  "--range-thumb-color": "rgba(97, 97, 102, 1)",
  "--range-decoration-active-color": "rgba(255, 215, 0, 0.6)"
};
var DarkGlassTheme = {
  "--widget-margin": "12px",
  "--button-size": "28px",
  "--button-corner-radius": "8px",
  "--button-background": "rgba(18, 18, 20, 0.75)",
  "--button-stroke": "rgba(18, 18, 20, 0.30)",
  "--button-inner-stroke": "1px solid rgba(18, 18, 20, 0.75)",
  "--button-shadow": "0px 0px 8px 0px rgba(0, 0, 0, 0.25), 0px 0px 8px 0px rgba(0, 0, 0, 0.1) inset",
  "--button-backdrop-filter": "blur(4px)",
  "--button-icon-idle": "rgba(158, 157, 168, 1)",
  "--button-icon-hover": "rgba(215, 214, 229, 1)",
  "--button-text": "rgb(215, 214, 229, 1)",
  "--icon-compass-north-color": "rgb(240, 92, 68)",
  "--icon-compass-south-color": "rgb(200, 199, 209)",
  "--menu-gap": "4px",
  "--menu-background": "rgba(18, 18, 20, 0.75)",
  "--menu-backdrop-filter": "blur(4px)",
  "--menu-border": "1px solid rgba(18, 18, 20, 0.75)",
  "--menu-shadow": "0px 0px 8px 0px rgba(0, 0, 0, 0.25), 0px 0px 8px 0px rgba(0, 0, 0, 0.1) inset",
  "--menu-text": "rgb(215, 214, 229, 1)",
  "--menu-item-hover": "rgba(255, 255, 255, 0.1)",
  "--range-step-button-size": "24px",
  "--range-track-size": "16px",
  "--range-thumb-size": "10px",
  "--range-track-color": "rgba(24, 24, 26, 0.3)",
  "--range-thumb-color": "rgba(158, 157, 168, 1)",
  "--range-decoration-active-color": "rgba(255, 145, 0, 0.6)"
};

// node_modules/@deck.gl/widgets/dist/theme-widget.js
var ThemeWidget = class extends Widget {
  constructor(props = {}) {
    super(props);
    this.className = "deck-widget-theme";
    this.placement = "top-left";
    this.themeMode = "dark";
    this.appliedTheme = {};
    this.themeMode = this._getInitialThemeMode();
    this.setProps(this.props);
  }
  // eslint-disable-next-line complexity
  setProps(props) {
    this.placement = props.placement ?? this.placement;
    this.viewId = props.viewId ?? this.viewId;
    super.setProps(props);
  }
  onRenderHTML(rootElement) {
    const { lightModeLabel, darkModeLabel } = this.props;
    const currentMode = this.getThemeMode();
    this._applyTheme(currentMode, rootElement);
    R(u2(IconButton, { onClick: this._handleClick.bind(this), label: currentMode === "dark" ? darkModeLabel : lightModeLabel, className: currentMode === "dark" ? "deck-widget-moon" : "deck-widget-sun" }), rootElement);
  }
  /**
   * Returns the current theme mode.
   * In controlled mode, returns the themeMode prop.
   * In uncontrolled mode, returns the internal state.
   */
  getThemeMode() {
    return this.props.themeMode ?? this.themeMode;
  }
  _handleClick() {
    var _a, _b;
    const currentMode = this.getThemeMode();
    const nextMode = currentMode === "dark" ? "light" : "dark";
    (_b = (_a = this.props).onThemeModeChange) == null ? void 0 : _b.call(_a, nextMode);
    if (this.props.themeMode === void 0) {
      this.themeMode = nextMode;
      this.updateHTML();
    }
  }
  /** Apply theme styling without changing internal state */
  _applyTheme(themeMode, rootElement) {
    const themeStyle = themeMode === "dark" ? this.props.darkModeTheme : this.props.lightModeTheme;
    if (deepEqual(themeStyle, this.appliedTheme, 1)) {
      return;
    }
    const container = rootElement.closest(".deck-widget-container");
    if (!container)
      return;
    applyStyles(container, themeStyle);
    this.appliedTheme = themeStyle;
    const label = themeMode === "dark" ? this.props.darkModeLabel : this.props.lightModeLabel;
    log_default.log(1, `Switched theme to ${label}`, themeStyle)();
  }
  /** Read browser preference */
  _getInitialThemeMode() {
    const { initialThemeMode } = this.props;
    if (initialThemeMode !== "auto") {
      return initialThemeMode;
    }
    if (typeof window === "undefined") {
      return "light";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
};
ThemeWidget.defaultProps = {
  ...Widget.defaultProps,
  id: "theme",
  placement: "top-left",
  viewId: null,
  lightModeLabel: "Light Mode",
  lightModeTheme: LightGlassTheme,
  darkModeLabel: "Dark Mode",
  darkModeTheme: DarkGlassTheme,
  initialThemeMode: "auto",
  themeMode: void 0,
  onThemeModeChange: () => {
  }
};

// node_modules/@deck.gl/widgets/dist/loading-widget.js
var LoadingWidget = class extends Widget {
  constructor(props = {}) {
    super(props);
    this.className = "deck-widget-loading";
    this.placement = "top-left";
    this.loading = true;
    this.setProps(this.props);
  }
  setProps(props) {
    this.placement = props.placement ?? this.placement;
    this.viewId = props.viewId ?? this.viewId;
    super.setProps(props);
  }
  onRenderHTML(rootElement) {
    R(
      // TODO(ibgreen) - this should not be a button, but styling is so nested that it is easier to reuse this component.
      this.loading && u2(IconButton, { className: "deck-widget-spinner", label: this.props.label, onClick: this.handleClick.bind(this) }),
      rootElement
    );
  }
  onRedraw({ layers }) {
    var _a, _b;
    const loading = layers.some((layer) => !layer.isLoaded);
    if (loading !== this.loading) {
      this.loading = loading;
      (_b = (_a = this.props).onLoadingChange) == null ? void 0 : _b.call(_a, loading);
      this.updateHTML();
    }
  }
  // TODO(ibgreen) - this should not be a button, see above.
  handleClick() {
  }
};
LoadingWidget.defaultProps = {
  ...Widget.defaultProps,
  id: "loading",
  placement: "top-left",
  viewId: null,
  label: "Loading layer data",
  onLoadingChange: () => {
  }
};

// node_modules/@deck.gl/widgets/dist/stats-widget.js
var DEFAULT_COUNT_FORMATTER = (stat) => `${stat.name}: ${stat.count}`;
function formatTime(time) {
  return time < 1e3 ? `${time.toFixed(2)}ms` : `${(time / 1e3).toFixed(2)}s`;
}
function formatMemory(bytes) {
  const mb = bytes / 1e6;
  return `${mb.toFixed(1)} MB`;
}
var DEFAULT_FORMATTERS = {
  count: DEFAULT_COUNT_FORMATTER,
  averageTime: (stat) => `${stat.name}: ${formatTime(stat.getAverageTime())}`,
  totalTime: (stat) => `${stat.name}: ${formatTime(stat.time)}`,
  fps: (stat) => `${stat.name}: ${Math.round(stat.getHz())}fps`,
  memory: (stat) => `${stat.name}: ${formatMemory(stat.count)}`
};
var StatsWidget = class extends Widget {
  /**
   * Returns the current expanded state.
   * In controlled mode, returns the expanded prop.
   * In uncontrolled mode, returns the internal state.
   */
  getExpanded() {
    return this.props.expanded ?? this._expanded;
  }
  constructor(props = {}) {
    super(props);
    this.className = "deck-widget-stats";
    this.placement = "top-left";
    this._counter = 0;
    this._expanded = false;
    this._toggleExpanded = () => {
      var _a, _b;
      const nextExpanded = !this.getExpanded();
      (_b = (_a = this.props).onExpandedChange) == null ? void 0 : _b.call(_a, nextExpanded);
      if (this.props.expanded === void 0) {
        this._expanded = nextExpanded;
        this.updateHTML();
      }
    };
    this._getFps = () => {
      var _a;
      return Math.round(((_a = this.deck) == null ? void 0 : _a.metrics.fps) ?? 0);
    };
    this._formatters = { ...DEFAULT_FORMATTERS };
    this._resetOnUpdate = { ...this.props.resetOnUpdate };
    this._expanded = Boolean(props.initialExpanded);
    this.setProps(props);
  }
  setProps(props) {
    this.placement = props.placement ?? this.placement;
    this.viewId = props.viewId ?? this.viewId;
    if (props.formatters) {
      for (const name in props.formatters) {
        const f4 = props.formatters[name];
        this._formatters[name] = typeof f4 === "string" ? DEFAULT_FORMATTERS[f4] || DEFAULT_COUNT_FORMATTER : f4;
      }
    }
    if (props.resetOnUpdate) {
      this._resetOnUpdate = { ...props.resetOnUpdate };
    }
    super.setProps(props);
  }
  onRemove() {
    if (this.rootElement) {
      R(null, this.rootElement);
    }
  }
  onRenderHTML(rootElement) {
    const isExpanded = this.getExpanded();
    if (!isExpanded) {
      R(u2(FpsIcon, { getFps: this._getFps, onClick: this._toggleExpanded }), rootElement);
      return;
    }
    const stats = this._getStats();
    const title = this.props.title || ("id" in stats ? stats.id : null) || "Stats";
    const deviceLabel = this._getDeviceLabel();
    const items = [];
    if (stats) {
      stats.forEach((stat) => {
        const lines = this._getLines(stat).split("\n");
        if (this._resetOnUpdate && this._resetOnUpdate[stat.name]) {
          stat.reset();
        }
        lines.forEach((line, i4) => {
          items.push(u2("div", { style: { whiteSpace: "pre" }, children: line }, `${stat.name}-${i4}`));
        });
      });
    }
    R(u2("div", { className: "deck-widget-stats-container", style: { cursor: "default" }, children: [u2("div", { className: "deck-widget-stats-header", style: { cursor: "pointer", pointerEvents: "auto" }, onClick: this._toggleExpanded, children: [u2("b", { children: title }), deviceLabel && u2("span", { className: "deck-widget-stats-device", children: deviceLabel }), u2("button", { className: "deck-widget-dropdown-button", children: u2("span", { className: "deck-widget-dropdown-icon open" }) })] }), u2("div", { className: "deck-widget-stats-content", children: items })] }), rootElement);
  }
  onRedraw() {
    if (this.getExpanded()) {
      const framesPerUpdate = Math.max(1, this.props.framesPerUpdate || 1);
      if (this._counter++ % framesPerUpdate === 0) {
        this.updateHTML();
      }
    }
  }
  _getStats() {
    var _a, _b;
    switch (this.props.type) {
      case "deck":
        const metrics = ((_a = this.deck) == null ? void 0 : _a.metrics) ?? {};
        return Object.entries(metrics);
      case "luma":
        return Array.from(luma.stats.stats.values())[0];
      case "device":
        const device = (_b = this.deck) == null ? void 0 : _b.device;
        const stats = device == null ? void 0 : device.statsManager.stats.values();
        return stats ? Array.from(stats)[0] : [];
      case "custom":
        return this.props.stats;
      default:
        throw new Error(`Unknown stats type: ${this.props.type}`);
    }
  }
  _getDeviceLabel() {
    var _a, _b;
    const deviceType = (_b = (_a = this.deck) == null ? void 0 : _a.device) == null ? void 0 : _b.type;
    if (!deviceType) {
      return null;
    }
    switch (deviceType) {
      case "webgpu":
        return "WebGPU";
      case "webgl":
        return "WebGL";
      default:
        return String(deviceType);
    }
  }
  _getLines(stat) {
    if ("count" in stat) {
      const formatter = this._formatters[stat.name] || this._formatters[stat.type || ""] || DEFAULT_COUNT_FORMATTER;
      return formatter(stat);
    }
    const [key, value] = stat;
    const formattedValue = key.endsWith("Memory") ? formatMemory(value) : key.includes("Time") ? formatTime(value) : `${value.toFixed(2)}`;
    return `${key}: ${formattedValue}`;
  }
};
StatsWidget.defaultProps = {
  ...Widget.defaultProps,
  type: "deck",
  placement: "top-left",
  viewId: null,
  initialExpanded: false,
  stats: void 0,
  title: "Stats",
  framesPerUpdate: 1,
  formatters: {},
  resetOnUpdate: {},
  id: "stats",
  expanded: void 0,
  onExpandedChange: () => {
  }
};
function FpsIcon({ getFps, onClick }) {
  const [fps, setFps] = d2(getFps());
  h2(() => {
    const onUpdate = () => {
      setFps(getFps());
      timer = requestAnimationFrame(onUpdate);
    };
    let timer = requestAnimationFrame(onUpdate);
    return () => {
      cancelAnimationFrame(timer);
    };
  }, [getFps]);
  return u2(IconButton, { onClick, children: u2("div", { className: "text", children: ["FPS", u2("br", {}), fps] }) });
}

// node_modules/@deck.gl/react/dist/utils/use-widget.js
var import_react7 = __toESM(require_react(), 1);
function useWidget(WidgetClass, props) {
  const context = (0, import_react7.useContext)(DeckGlContext);
  const { widgets, deck } = context;
  (0, import_react7.useEffect)(() => {
    const internalWidgets = deck == null ? void 0 : deck.props.widgets;
    if ((widgets == null ? void 0 : widgets.length) && (internalWidgets == null ? void 0 : internalWidgets.length) && !deepEqual(internalWidgets, widgets, 1)) {
      log_default.warn('"widgets" prop will be ignored because React widgets are in use.')();
    }
    return () => {
      const index = widgets == null ? void 0 : widgets.indexOf(widget);
      if (index !== void 0 && index !== -1) {
        widgets == null ? void 0 : widgets.splice(index, 1);
        deck == null ? void 0 : deck.setProps({ widgets });
      }
    };
  }, []);
  const widget = (0, import_react7.useMemo)(() => new WidgetClass(props), [WidgetClass]);
  widgets == null ? void 0 : widgets.push(widget);
  widget.setProps(props);
  (0, import_react7.useEffect)(() => {
    deck == null ? void 0 : deck.setProps({ widgets });
  }, [widgets]);
  return widget;
}

// node_modules/@deck.gl/react/dist/widgets/compass-widget.js
var CompassWidget2 = (props = {}) => {
  useWidget(CompassWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/fullscreen-widget.js
var FullscreenWidget2 = (props = {}) => {
  useWidget(FullscreenWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/zoom-widget.js
var ZoomWidget2 = (props = {}) => {
  useWidget(ZoomWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/gimbal-widget.js
var GimbalWidget2 = (props = {}) => {
  useWidget(GimbalWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/geocoder-widget.js
var GeocoderWidget2 = (props = {}) => {
  useWidget(GeocoderWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/info-widget.js
var InfoWidget2 = (props) => {
  useWidget(InfoWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/popup-widget.js
var PopupWidget2 = (props) => {
  useWidget(PopupWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/context-menu-widget.js
var ContextMenuWidget2 = (props) => {
  useWidget(ContextMenuWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/scrollbar-widget.js
var ScrollbarWidget2 = (props = {}) => {
  useWidget(ScrollbarWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/icon-widget.js
var IconWidget2 = (props) => {
  useWidget(IconWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/toggle-widget.js
var ToggleWidget2 = (props) => {
  useWidget(ToggleWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/selector-widget.js
var SelectorWidget2 = (props) => {
  useWidget(SelectorWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/loading-widget.js
var LoadingWidget2 = (props = {}) => {
  useWidget(LoadingWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/reset-view-widget.js
var ResetViewWidget2 = (props = {}) => {
  useWidget(ResetViewWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/scale-widget.js
var ScaleWidget2 = (props = {}) => {
  useWidget(ScaleWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/screenshot-widget.js
var ScreenshotWidget2 = (props = {}) => {
  useWidget(ScreenshotWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/splitter-widget.js
var SplitterWidget2 = (props) => {
  useWidget(SplitterWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/theme-widget.js
var ThemeWidget2 = (props = {}) => {
  useWidget(ThemeWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/timeline-widget.js
var TimelineWidget2 = (props = {}) => {
  useWidget(TimelineWidget, props);
  return null;
};

// node_modules/@deck.gl/react/dist/widgets/stats-widget.js
var StatsWidget2 = (props = {}) => {
  useWidget(StatsWidget, props);
  return null;
};
export {
  CompassWidget2 as CompassWidget,
  ContextMenuWidget2 as ContextMenuWidget,
  deckgl_default as DeckGL,
  FullscreenWidget2 as FullscreenWidget,
  GimbalWidget2 as GimbalWidget,
  IconWidget2 as IconWidget,
  InfoWidget2 as InfoWidget,
  LoadingWidget2 as LoadingWidget,
  PopupWidget2 as PopupWidget,
  ResetViewWidget2 as ResetViewWidget,
  ScreenshotWidget2 as ScreenshotWidget,
  ScrollbarWidget2 as ScrollbarWidget,
  SelectorWidget2 as SelectorWidget,
  ThemeWidget2 as ThemeWidget,
  ToggleWidget2 as ToggleWidget,
  ZoomWidget2 as ZoomWidget,
  GeocoderWidget2 as _GeocoderWidget,
  ScaleWidget2 as _ScaleWidget,
  SplitterWidget2 as _SplitterWidget,
  StatsWidget2 as _StatsWidget,
  TimelineWidget2 as _TimelineWidget,
  deckgl_default as default,
  useWidget
};
//# sourceMappingURL=@deck__gl_react.js.map
