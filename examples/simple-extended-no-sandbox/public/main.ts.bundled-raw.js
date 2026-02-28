// ../../node_modules/snabbdom/build/htmldomapi.js
function createElement(tagName2, options) {
  return document.createElement(tagName2, options);
}
function createElementNS(namespaceURI, qualifiedName, options) {
  return document.createElementNS(namespaceURI, qualifiedName, options);
}
function createDocumentFragment() {
  return parseFragment(document.createDocumentFragment());
}
function createTextNode(text) {
  return document.createTextNode(text);
}
function createComment(text) {
  return document.createComment(text);
}
function insertBefore(parentNode2, newNode, referenceNode) {
  if (isDocumentFragment(parentNode2)) {
    let node = parentNode2;
    while (node && isDocumentFragment(node)) {
      const fragment2 = parseFragment(node);
      node = fragment2.parent;
    }
    parentNode2 = node !== null && node !== void 0 ? node : parentNode2;
  }
  if (isDocumentFragment(newNode)) {
    newNode = parseFragment(newNode, parentNode2);
  }
  if (referenceNode && isDocumentFragment(referenceNode)) {
    referenceNode = parseFragment(referenceNode).firstChildNode;
  }
  parentNode2.insertBefore(newNode, referenceNode);
}
function removeChild(node, child) {
  node.removeChild(child);
}
function appendChild(node, child) {
  if (isDocumentFragment(child)) {
    child = parseFragment(child, node);
  }
  node.appendChild(child);
}
function parentNode(node) {
  if (isDocumentFragment(node)) {
    while (node && isDocumentFragment(node)) {
      const fragment2 = parseFragment(node);
      node = fragment2.parent;
    }
    return node !== null && node !== void 0 ? node : null;
  }
  return node.parentNode;
}
function nextSibling(node) {
  var _a;
  if (isDocumentFragment(node)) {
    const fragment2 = parseFragment(node);
    const parent = parentNode(fragment2);
    if (parent && fragment2.lastChildNode) {
      const children = Array.from(parent.childNodes);
      const index = children.indexOf(fragment2.lastChildNode);
      return (_a = children[index + 1]) !== null && _a !== void 0 ? _a : null;
    }
    return null;
  }
  return node.nextSibling;
}
function tagName(elm) {
  return elm.tagName;
}
function setTextContent(node, text) {
  node.textContent = text;
}
function getTextContent(node) {
  return node.textContent;
}
function isElement(node) {
  return node.nodeType === 1;
}
function isText(node) {
  return node.nodeType === 3;
}
function isComment(node) {
  return node.nodeType === 8;
}
function isDocumentFragment(node) {
  return node.nodeType === 11;
}
function parseFragment(fragmentNode, parentNode2) {
  var _a, _b, _c;
  const fragment2 = fragmentNode;
  (_a = fragment2.parent) !== null && _a !== void 0 ? _a : fragment2.parent = parentNode2 !== null && parentNode2 !== void 0 ? parentNode2 : null;
  (_b = fragment2.firstChildNode) !== null && _b !== void 0 ? _b : fragment2.firstChildNode = fragmentNode.firstChild;
  (_c = fragment2.lastChildNode) !== null && _c !== void 0 ? _c : fragment2.lastChildNode = fragmentNode.lastChild;
  return fragment2;
}
var htmlDomApi = {
  createElement,
  createElementNS,
  createTextNode,
  createDocumentFragment,
  createComment,
  insertBefore,
  removeChild,
  appendChild,
  parentNode,
  nextSibling,
  tagName,
  setTextContent,
  getTextContent,
  isElement,
  isText,
  isComment,
  isDocumentFragment
};

// ../../node_modules/snabbdom/build/vnode.js
function vnode(sel, data, children, text, elm) {
  const key = data === void 0 ? void 0 : data.key;
  return { sel, data, children, text, elm, key };
}

// ../../node_modules/snabbdom/build/is.js
var array = Array.isArray;
function primitive(s) {
  return typeof s === "string" || typeof s === "number" || s instanceof String || s instanceof Number;
}

// ../../node_modules/snabbdom/build/init.js
var emptyNode = vnode("", {}, [], void 0, void 0);
function sameVnode(vnode1, vnode2) {
  var _a, _b;
  const isSameKey = vnode1.key === vnode2.key;
  const isSameIs = ((_a = vnode1.data) === null || _a === void 0 ? void 0 : _a.is) === ((_b = vnode2.data) === null || _b === void 0 ? void 0 : _b.is);
  const isSameSel = vnode1.sel === vnode2.sel;
  const isSameTextOrFragment = !vnode1.sel && vnode1.sel === vnode2.sel ? typeof vnode1.text === typeof vnode2.text : true;
  return isSameSel && isSameKey && isSameIs && isSameTextOrFragment;
}
function documentFragmentIsNotSupported() {
  throw new Error("The document fragment is not supported on this platform.");
}
function isElement2(api, vnode2) {
  return api.isElement(vnode2);
}
function isDocumentFragment2(api, vnode2) {
  return api.isDocumentFragment(vnode2);
}
function createKeyToOldIdx(children, beginIdx, endIdx) {
  var _a;
  const map = {};
  for (let i = beginIdx; i <= endIdx; ++i) {
    const key = (_a = children[i]) === null || _a === void 0 ? void 0 : _a.key;
    if (key !== void 0) {
      map[key] = i;
    }
  }
  return map;
}
var hooks = [
  "create",
  "update",
  "remove",
  "destroy",
  "pre",
  "post"
];
function init(modules, domApi, options) {
  const cbs = {
    create: [],
    update: [],
    remove: [],
    destroy: [],
    pre: [],
    post: []
  };
  const api = domApi !== void 0 ? domApi : htmlDomApi;
  for (const hook of hooks) {
    for (const module of modules) {
      const currentHook = module[hook];
      if (currentHook !== void 0) {
        cbs[hook].push(currentHook);
      }
    }
  }
  function emptyNodeAt(elm) {
    const id = elm.id ? "#" + elm.id : "";
    const classes = elm.getAttribute("class");
    const c = classes ? "." + classes.split(" ").join(".") : "";
    return vnode(api.tagName(elm).toLowerCase() + id + c, {}, [], void 0, elm);
  }
  function emptyDocumentFragmentAt(frag) {
    return vnode(void 0, {}, [], void 0, frag);
  }
  function createRmCb(childElm, listeners) {
    return function rmCb() {
      if (--listeners === 0) {
        const parent = api.parentNode(childElm);
        if (parent !== null) {
          api.removeChild(parent, childElm);
        }
      }
    };
  }
  function createElm(vnode2, insertedVnodeQueue) {
    var _a, _b, _c, _d, _e;
    let i;
    const data = vnode2.data;
    const hook = data === null || data === void 0 ? void 0 : data.hook;
    (_a = hook === null || hook === void 0 ? void 0 : hook.init) === null || _a === void 0 ? void 0 : _a.call(hook, vnode2);
    const children = vnode2.children;
    const sel = vnode2.sel;
    if (sel === "!") {
      (_b = vnode2.text) !== null && _b !== void 0 ? _b : vnode2.text = "";
      vnode2.elm = api.createComment(vnode2.text);
    } else if (sel === "") {
      vnode2.elm = api.createTextNode(vnode2.text);
    } else if (sel !== void 0) {
      const hashIdx = sel.indexOf("#");
      const dotIdx = sel.indexOf(".", hashIdx);
      const hash = hashIdx > 0 ? hashIdx : sel.length;
      const dot = dotIdx > 0 ? dotIdx : sel.length;
      const tag = hashIdx !== -1 || dotIdx !== -1 ? sel.slice(0, Math.min(hash, dot)) : sel;
      const ns = data === null || data === void 0 ? void 0 : data.ns;
      const elm = ns === void 0 ? api.createElement(tag, data) : api.createElementNS(ns, tag, data);
      vnode2.elm = elm;
      if (hash < dot)
        elm.setAttribute("id", sel.slice(hash + 1, dot));
      if (dotIdx > 0)
        elm.setAttribute("class", sel.slice(dot + 1).replace(/\./g, " "));
      for (i = 0; i < cbs.create.length; ++i)
        cbs.create[i](emptyNode, vnode2);
      if (primitive(vnode2.text) && (!array(children) || children.length === 0)) {
        api.appendChild(elm, api.createTextNode(vnode2.text));
      }
      if (array(children)) {
        for (i = 0; i < children.length; ++i) {
          const ch = children[i];
          if (ch != null) {
            api.appendChild(elm, createElm(ch, insertedVnodeQueue));
          }
        }
      }
      if (hook !== void 0) {
        (_c = hook.create) === null || _c === void 0 ? void 0 : _c.call(hook, emptyNode, vnode2);
        if (hook.insert !== void 0) {
          insertedVnodeQueue.push(vnode2);
        }
      }
    } else if (((_d = options === null || options === void 0 ? void 0 : options.experimental) === null || _d === void 0 ? void 0 : _d.fragments) && vnode2.children) {
      vnode2.elm = ((_e = api.createDocumentFragment) !== null && _e !== void 0 ? _e : documentFragmentIsNotSupported)();
      for (i = 0; i < cbs.create.length; ++i)
        cbs.create[i](emptyNode, vnode2);
      for (i = 0; i < vnode2.children.length; ++i) {
        const ch = vnode2.children[i];
        if (ch != null) {
          api.appendChild(vnode2.elm, createElm(ch, insertedVnodeQueue));
        }
      }
    } else {
      vnode2.elm = api.createTextNode(vnode2.text);
    }
    return vnode2.elm;
  }
  function addVnodes(parentElm, before, vnodes, startIdx, endIdx, insertedVnodeQueue) {
    for (; startIdx <= endIdx; ++startIdx) {
      const ch = vnodes[startIdx];
      if (ch != null) {
        api.insertBefore(parentElm, createElm(ch, insertedVnodeQueue), before);
      }
    }
  }
  function invokeDestroyHook(vnode2) {
    var _a, _b;
    const data = vnode2.data;
    if (data !== void 0) {
      (_b = (_a = data === null || data === void 0 ? void 0 : data.hook) === null || _a === void 0 ? void 0 : _a.destroy) === null || _b === void 0 ? void 0 : _b.call(_a, vnode2);
      for (let i = 0; i < cbs.destroy.length; ++i)
        cbs.destroy[i](vnode2);
      if (vnode2.children !== void 0) {
        for (let j = 0; j < vnode2.children.length; ++j) {
          const child = vnode2.children[j];
          if (child != null && typeof child !== "string") {
            invokeDestroyHook(child);
          }
        }
      }
    }
  }
  function removeVnodes(parentElm, vnodes, startIdx, endIdx) {
    var _a, _b;
    for (; startIdx <= endIdx; ++startIdx) {
      let listeners;
      const ch = vnodes[startIdx];
      if (ch != null) {
        if (ch.sel !== void 0) {
          invokeDestroyHook(ch);
          listeners = cbs.remove.length + 1;
          const rm = createRmCb(ch.elm, listeners);
          for (let i = 0; i < cbs.remove.length; ++i)
            cbs.remove[i](ch, rm);
          const removeHook = (_b = (_a = ch === null || ch === void 0 ? void 0 : ch.data) === null || _a === void 0 ? void 0 : _a.hook) === null || _b === void 0 ? void 0 : _b.remove;
          if (removeHook !== void 0) {
            removeHook(ch, rm);
          } else {
            rm();
          }
        } else if (ch.children) {
          invokeDestroyHook(ch);
          removeVnodes(parentElm, ch.children, 0, ch.children.length - 1);
        } else {
          api.removeChild(parentElm, ch.elm);
        }
      }
    }
  }
  function updateChildren(parentElm, oldCh, newCh, insertedVnodeQueue) {
    let oldStartIdx = 0;
    let newStartIdx = 0;
    let oldEndIdx = oldCh.length - 1;
    let oldStartVnode = oldCh[0];
    let oldEndVnode = oldCh[oldEndIdx];
    let newEndIdx = newCh.length - 1;
    let newStartVnode = newCh[0];
    let newEndVnode = newCh[newEndIdx];
    let oldKeyToIdx;
    let idxInOld;
    let elmToMove;
    let before;
    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      if (oldStartVnode == null) {
        oldStartVnode = oldCh[++oldStartIdx];
      } else if (oldEndVnode == null) {
        oldEndVnode = oldCh[--oldEndIdx];
      } else if (newStartVnode == null) {
        newStartVnode = newCh[++newStartIdx];
      } else if (newEndVnode == null) {
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldStartVnode, newStartVnode)) {
        patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue);
        oldStartVnode = oldCh[++oldStartIdx];
        newStartVnode = newCh[++newStartIdx];
      } else if (sameVnode(oldEndVnode, newEndVnode)) {
        patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue);
        oldEndVnode = oldCh[--oldEndIdx];
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldStartVnode, newEndVnode)) {
        patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue);
        api.insertBefore(parentElm, oldStartVnode.elm, api.nextSibling(oldEndVnode.elm));
        oldStartVnode = oldCh[++oldStartIdx];
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldEndVnode, newStartVnode)) {
        patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue);
        api.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm);
        oldEndVnode = oldCh[--oldEndIdx];
        newStartVnode = newCh[++newStartIdx];
      } else {
        if (oldKeyToIdx === void 0) {
          oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);
        }
        idxInOld = oldKeyToIdx[newStartVnode.key];
        if (idxInOld === void 0) {
          api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm);
          newStartVnode = newCh[++newStartIdx];
        } else if (oldKeyToIdx[newEndVnode.key] === void 0) {
          api.insertBefore(parentElm, createElm(newEndVnode, insertedVnodeQueue), api.nextSibling(oldEndVnode.elm));
          newEndVnode = newCh[--newEndIdx];
        } else {
          elmToMove = oldCh[idxInOld];
          if (elmToMove.sel !== newStartVnode.sel) {
            api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm);
          } else {
            patchVnode(elmToMove, newStartVnode, insertedVnodeQueue);
            oldCh[idxInOld] = void 0;
            api.insertBefore(parentElm, elmToMove.elm, oldStartVnode.elm);
          }
          newStartVnode = newCh[++newStartIdx];
        }
      }
    }
    if (newStartIdx <= newEndIdx) {
      before = newCh[newEndIdx + 1] == null ? null : newCh[newEndIdx + 1].elm;
      addVnodes(parentElm, before, newCh, newStartIdx, newEndIdx, insertedVnodeQueue);
    }
    if (oldStartIdx <= oldEndIdx) {
      removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx);
    }
  }
  function patchVnode(oldVnode, vnode2, insertedVnodeQueue) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const hook = (_a = vnode2.data) === null || _a === void 0 ? void 0 : _a.hook;
    (_b = hook === null || hook === void 0 ? void 0 : hook.prepatch) === null || _b === void 0 ? void 0 : _b.call(hook, oldVnode, vnode2);
    const elm = vnode2.elm = oldVnode.elm;
    if (oldVnode === vnode2)
      return;
    if (vnode2.data !== void 0 || vnode2.text !== void 0 && vnode2.text !== oldVnode.text) {
      (_c = vnode2.data) !== null && _c !== void 0 ? _c : vnode2.data = {};
      (_d = oldVnode.data) !== null && _d !== void 0 ? _d : oldVnode.data = {};
      for (let i = 0; i < cbs.update.length; ++i)
        cbs.update[i](oldVnode, vnode2);
      (_g = (_f = (_e = vnode2.data) === null || _e === void 0 ? void 0 : _e.hook) === null || _f === void 0 ? void 0 : _f.update) === null || _g === void 0 ? void 0 : _g.call(_f, oldVnode, vnode2);
    }
    const oldCh = oldVnode.children;
    const ch = vnode2.children;
    if (vnode2.text === void 0) {
      if (oldCh !== void 0 && ch !== void 0) {
        if (oldCh !== ch)
          updateChildren(elm, oldCh, ch, insertedVnodeQueue);
      } else if (ch !== void 0) {
        if (oldVnode.text !== void 0)
          api.setTextContent(elm, "");
        addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue);
      } else if (oldCh !== void 0) {
        removeVnodes(elm, oldCh, 0, oldCh.length - 1);
      } else if (oldVnode.text !== void 0) {
        api.setTextContent(elm, "");
      }
    } else if (oldVnode.text !== vnode2.text) {
      if (oldCh !== void 0) {
        removeVnodes(elm, oldCh, 0, oldCh.length - 1);
      }
      api.setTextContent(elm, vnode2.text);
    }
    (_h = hook === null || hook === void 0 ? void 0 : hook.postpatch) === null || _h === void 0 ? void 0 : _h.call(hook, oldVnode, vnode2);
  }
  return function patch(oldVnode, vnode2) {
    let i, elm, parent;
    const insertedVnodeQueue = [];
    for (i = 0; i < cbs.pre.length; ++i)
      cbs.pre[i]();
    if (isElement2(api, oldVnode)) {
      oldVnode = emptyNodeAt(oldVnode);
    } else if (isDocumentFragment2(api, oldVnode)) {
      oldVnode = emptyDocumentFragmentAt(oldVnode);
    }
    if (sameVnode(oldVnode, vnode2)) {
      patchVnode(oldVnode, vnode2, insertedVnodeQueue);
    } else {
      elm = oldVnode.elm;
      parent = api.parentNode(elm);
      createElm(vnode2, insertedVnodeQueue);
      if (parent !== null) {
        api.insertBefore(parent, vnode2.elm, api.nextSibling(elm));
        removeVnodes(parent, [oldVnode], 0, 0);
      }
    }
    for (i = 0; i < insertedVnodeQueue.length; ++i) {
      insertedVnodeQueue[i].data.hook.insert(insertedVnodeQueue[i]);
    }
    for (i = 0; i < cbs.post.length; ++i)
      cbs.post[i]();
    return vnode2;
  };
}

// ../../node_modules/snabbdom/build/h.js
function addNS(data, children, sel) {
  data.ns = "http://www.w3.org/2000/svg";
  if (sel !== "foreignObject" && children !== void 0) {
    for (let i = 0; i < children.length; ++i) {
      const child = children[i];
      if (typeof child === "string")
        continue;
      const childData = child.data;
      if (childData !== void 0) {
        addNS(childData, child.children, child.sel);
      }
    }
  }
}
function h(sel, b, c) {
  let data = {};
  let children;
  let text;
  let i;
  if (c !== void 0) {
    if (b !== null) {
      data = b;
    }
    if (array(c)) {
      children = c;
    } else if (primitive(c)) {
      text = c.toString();
    } else if (c && c.sel) {
      children = [c];
    }
  } else if (b !== void 0 && b !== null) {
    if (array(b)) {
      children = b;
    } else if (primitive(b)) {
      text = b.toString();
    } else if (b && b.sel) {
      children = [b];
    } else {
      data = b;
    }
  }
  if (children !== void 0) {
    for (i = 0; i < children.length; ++i) {
      if (primitive(children[i]))
        children[i] = vnode(void 0, void 0, void 0, children[i], void 0);
    }
  }
  if (sel.startsWith("svg") && (sel.length === 3 || sel[3] === "." || sel[3] === "#")) {
    addNS(data, children, sel);
  }
  return vnode(sel, data, children, text, void 0);
}

// ../../node_modules/snabbdom/build/modules/class.js
function updateClass(oldVnode, vnode2) {
  let cur;
  let name;
  const elm = vnode2.elm;
  let oldClass = oldVnode.data.class;
  let klass = vnode2.data.class;
  if (!oldClass && !klass)
    return;
  if (oldClass === klass)
    return;
  oldClass = oldClass || {};
  klass = klass || {};
  for (name in oldClass) {
    if (oldClass[name] && !Object.prototype.hasOwnProperty.call(klass, name)) {
      elm.classList.remove(name);
    }
  }
  for (name in klass) {
    cur = klass[name];
    if (cur !== oldClass[name]) {
      elm.classList[cur ? "add" : "remove"](name);
    }
  }
}
var classModule = { create: updateClass, update: updateClass };

// ../../node_modules/snabbdom/build/modules/eventlisteners.js
function invokeHandler(handler, vnode2, event) {
  if (typeof handler === "function") {
    handler.call(vnode2, event, vnode2);
  } else if (typeof handler === "object") {
    for (let i = 0; i < handler.length; i++) {
      invokeHandler(handler[i], vnode2, event);
    }
  }
}
function handleEvent(event, vnode2) {
  const name = event.type;
  const on = vnode2.data.on;
  if (on && on[name]) {
    invokeHandler(on[name], vnode2, event);
  }
}
function createListener() {
  return function handler(event) {
    handleEvent(event, handler.vnode);
  };
}
function updateEventListeners(oldVnode, vnode2) {
  const oldOn = oldVnode.data.on;
  const oldListener = oldVnode.listener;
  const oldElm = oldVnode.elm;
  const on = vnode2 && vnode2.data.on;
  const elm = vnode2 && vnode2.elm;
  let name;
  if (oldOn === on) {
    return;
  }
  if (oldOn && oldListener) {
    if (!on) {
      for (name in oldOn) {
        oldElm.removeEventListener(name, oldListener, false);
      }
    } else {
      for (name in oldOn) {
        if (!on[name]) {
          oldElm.removeEventListener(name, oldListener, false);
        }
      }
    }
  }
  if (on) {
    const listener = vnode2.listener = oldVnode.listener || createListener();
    listener.vnode = vnode2;
    if (!oldOn) {
      for (name in on) {
        elm.addEventListener(name, listener, false);
      }
    } else {
      for (name in on) {
        if (!oldOn[name]) {
          elm.addEventListener(name, listener, false);
        }
      }
    }
  }
}
var eventListenersModule = {
  create: updateEventListeners,
  update: updateEventListeners,
  destroy: updateEventListeners
};

// ../../node_modules/snabbdom/build/modules/props.js
function updateProps(oldVnode, vnode2) {
  let key;
  let cur;
  let old;
  const elm = vnode2.elm;
  let oldProps = oldVnode.data.props;
  let props = vnode2.data.props;
  if (!oldProps && !props)
    return;
  if (oldProps === props)
    return;
  oldProps = oldProps || {};
  props = props || {};
  for (key in props) {
    cur = props[key];
    old = oldProps[key];
    if (old !== cur && (key !== "value" || elm[key] !== cur)) {
      elm[key] = cur;
    }
  }
}
var propsModule = { create: updateProps, update: updateProps };

// ../../node_modules/snabbdom/build/modules/style.js
var raf = typeof (window === null || window === void 0 ? void 0 : window.requestAnimationFrame) === "function" ? window.requestAnimationFrame.bind(window) : setTimeout;
var nextFrame = (fn) => {
  raf(() => {
    raf(fn);
  });
};
var reflowForced = false;
function setNextFrame(obj, prop, val) {
  nextFrame(() => {
    obj[prop] = val;
  });
}
function updateStyle(oldVnode, vnode2) {
  let cur;
  let name;
  const elm = vnode2.elm;
  let oldStyle = oldVnode.data.style;
  let style = vnode2.data.style;
  if (!oldStyle && !style)
    return;
  if (oldStyle === style)
    return;
  oldStyle = oldStyle || {};
  style = style || {};
  const oldHasDel = "delayed" in oldStyle;
  for (name in oldStyle) {
    if (!(name in style)) {
      if (name[0] === "-" && name[1] === "-") {
        elm.style.removeProperty(name);
      } else {
        elm.style[name] = "";
      }
    }
  }
  for (name in style) {
    cur = style[name];
    if (name === "delayed" && style.delayed) {
      for (const name2 in style.delayed) {
        cur = style.delayed[name2];
        if (!oldHasDel || cur !== oldStyle.delayed[name2]) {
          setNextFrame(elm.style, name2, cur);
        }
      }
    } else if (name !== "remove" && cur !== oldStyle[name]) {
      if (name[0] === "-" && name[1] === "-") {
        elm.style.setProperty(name, cur);
      } else {
        elm.style[name] = cur;
      }
    }
  }
}
function applyDestroyStyle(vnode2) {
  let style;
  let name;
  const elm = vnode2.elm;
  const s = vnode2.data.style;
  if (!s || !(style = s.destroy))
    return;
  for (name in style) {
    elm.style[name] = style[name];
  }
}
function applyRemoveStyle(vnode2, rm) {
  const s = vnode2.data.style;
  if (!s || !s.remove) {
    rm();
    return;
  }
  if (!reflowForced) {
    vnode2.elm.offsetLeft;
    reflowForced = true;
  }
  let name;
  const elm = vnode2.elm;
  let i = 0;
  const style = s.remove;
  let amount = 0;
  const applied = [];
  for (name in style) {
    applied.push(name);
    elm.style[name] = style[name];
  }
  const compStyle = getComputedStyle(elm);
  const props = compStyle["transition-property"].split(", ");
  for (; i < props.length; ++i) {
    if (applied.indexOf(props[i]) !== -1)
      amount++;
  }
  elm.addEventListener("transitionend", (ev) => {
    if (ev.target === elm)
      --amount;
    if (amount === 0)
      rm();
  });
}
function forceReflow() {
  reflowForced = false;
}
var styleModule = {
  pre: forceReflow,
  create: updateStyle,
  update: updateStyle,
  destroy: applyDestroyStyle,
  remove: applyRemoveStyle
};

// ../../packages/host/dist/ui.js
function $parcel$export(e, n, v, s) {
  Object.defineProperty(e, n, { get: v, set: s, enumerable: true, configurable: true });
}
var $7ecf692fb720ca8d$exports = {};
$parcel$export($7ecf692fb720ca8d$exports, "log", () => $7ecf692fb720ca8d$export$bef1f36f5486a6a3);
$parcel$export($7ecf692fb720ca8d$exports, "DruidUI", () => $7ecf692fb720ca8d$export$6874335aa33ac2fe);
var $4195f124d99f64a1$exports = {};
$parcel$export($4195f124d99f64a1$exports, "HttpFileLoader", () => $4195f124d99f64a1$export$c104e8094d57b0fc);
var $4195f124d99f64a1$export$c104e8094d57b0fc = class {
  constructor(baseUrl, authOptions, defaultHeaders) {
    this.baseUrl = baseUrl;
    this.authOptions = authOptions;
    this.defaultHeaders = defaultHeaders;
  }
  async loadHttp(path, options) {
    const headers = {
      ...this.defaultHeaders,
      ...options?.headers
    };
    const authToUse = options?.auth || this.authOptions;
    if (authToUse) switch (authToUse.type) {
      case "bearer":
        if (authToUse.token) headers["Authorization"] = `Bearer ${authToUse.token}`;
        break;
      case "basic":
        if (authToUse.username && authToUse.password) {
          const credentials = btoa(`${authToUse.username}:${authToUse.password}`);
          headers["Authorization"] = `Basic ${credentials}`;
        }
        break;
      case "api-key":
        if (authToUse.apiKey) {
          const headerName = authToUse.apiKeyHeader || "X-API-Key";
          headers[headerName] = authToUse.apiKey;
        }
        break;
    }
    const res = await fetch(path, {
      headers,
      cache: options?.cache === false ? "no-store" : "default"
    });
    if (!res.ok) throw new Error(`Failed to load file: ${path}, status: ${res.status}`);
    const text = await res.arrayBuffer();
    const responseHeaders = {};
    if (res.headers && typeof res.headers.forEach === "function") res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    const contentType = res.headers.get("Content-Type");
    return {
      buffer: text,
      headers: responseHeaders,
      contentType
    };
  }
  async load(path, options) {
    const filePath = this.baseUrl ? `${this.baseUrl}/${path}` : path;
    const response = await this.loadHttp(filePath, options);
    return response;
  }
};
var $7705509af6e2b475$export$b76953f99ab2be78 = (0, init)([
  // Init patch function with chosen modules
  (0, classModule),
  (0, propsModule),
  (0, styleModule),
  (0, eventListenersModule)
]);
var $47d6f20d5f21b2bd$exports = {};
$parcel$export($47d6f20d5f21b2bd$exports, "HistoryRoutingStrategy", () => $47d6f20d5f21b2bd$export$ec331118eb897269);
$parcel$export($47d6f20d5f21b2bd$exports, "CustomRoutingStrategy", () => $47d6f20d5f21b2bd$export$943a5be802561a9a);
$parcel$export($47d6f20d5f21b2bd$exports, "createRoutingStrategy", () => $47d6f20d5f21b2bd$export$df70df7318f5f0f3);
var $47d6f20d5f21b2bd$export$ec331118eb897269 = class {
  getCurrentPath() {
    return window.location.pathname;
  }
  navigateTo(path) {
    window.history.pushState({}, "", path);
  }
};
var $47d6f20d5f21b2bd$export$943a5be802561a9a = class {
  getCurrentPath() {
    return this.currentPath;
  }
  navigateTo(path) {
    this.currentPath = path;
  }
  constructor() {
    this.currentPath = "/";
  }
};
var $47d6f20d5f21b2bd$export$df70df7318f5f0f3 = (mode) => {
  if (mode === "custom") return new $47d6f20d5f21b2bd$export$943a5be802561a9a();
  else return new $47d6f20d5f21b2bd$export$ec331118eb897269();
};
var $afa3b9af1178429b$exports = {};
$parcel$export($afa3b9af1178429b$exports, "loadTranspile", () => $afa3b9af1178429b$export$76f430ef6626d809);
var $afa3b9af1178429b$var$CACHE_KEY_PREFIX = "transpile_cache_";
var $afa3b9af1178429b$var$getCachedEntry = (file) => {
  try {
    const cached = localStorage.getItem($afa3b9af1178429b$var$CACHE_KEY_PREFIX + file);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    console.warn("Failed to read from cache:", e);
  }
  return null;
};
var $afa3b9af1178429b$var$setCachedEntry = (file, entry) => {
  try {
    localStorage.setItem($afa3b9af1178429b$var$CACHE_KEY_PREFIX + file, JSON.stringify(entry));
  } catch (e) {
    console.warn("Failed to write to cache:", e);
  }
};
var $afa3b9af1178429b$var$transpileInWorker = async (buffer, name) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("transpile.worker.bc75f4c9.js", import.meta.url), {
      type: "module"
    });
    worker.onmessage = (event) => {
      worker.terminate();
      if (event.data.success) resolve(event.data.data);
      else reject(new Error(event.data.error));
    };
    worker.onerror = (error) => {
      worker.terminate();
      reject(error);
    };
    worker.postMessage({
      buffer,
      name
    }, [
      buffer
    ]);
  });
};
var $afa3b9af1178429b$export$76f430ef6626d809 = async (file, fileLoader) => {
  const cached = $afa3b9af1178429b$var$getCachedEntry(file);
  if (cached)
    try {
      await fetch(cached.jsUrl, {
        method: "HEAD"
      });
      return [
        cached.jsUrl,
        async (filename) => {
          const url = cached.fileUrls[filename];
          if (!url) throw new Error(`File ${filename} not found in transpiled output.`);
          const wasmResponse = await fetch(url);
          const wasmBuffer = await wasmResponse.arrayBuffer();
          return await WebAssembly.compile(wasmBuffer);
        }
      ];
    } catch (e) {
      console.warn("Cached URLs are stale, re-transpiling");
    }
  const response = await fileLoader.load(file);
  if (!response) throw new Error(`Failed to load file: ${file}`);
  const files = {};
  const t = await $afa3b9af1178429b$var$transpileInWorker(response.buffer, "test");
  for (const file2 of t.files) {
    const [f, content] = file2;
    let blob = null;
    if (f.endsWith(".js")) blob = new Blob([
      new Uint8Array(content)
    ], {
      type: "application/javascript"
    });
    else if (f.endsWith(".wasm")) blob = new Blob([
      new Uint8Array(content)
    ], {
      type: "application/wasm"
    });
    if (blob) {
      const url = URL.createObjectURL(blob);
      files[f] = url;
    }
  }
  const jsFileEntry = Object.entries(files).find(([filename]) => filename.endsWith(".js"));
  if (!jsFileEntry) throw new Error("No JavaScript file found in transpiled output.");
  const cacheEntry = {
    jsUrl: jsFileEntry[1],
    fileUrls: files
  };
  $afa3b9af1178429b$var$setCachedEntry(file, cacheEntry);
  return [
    jsFileEntry[1],
    async (filename) => {
      const url = files[filename];
      if (!url) throw new Error(`File ${filename} not found in transpiled output.`);
      const wasmResponse = await fetch(url);
      const wasmBuffer = await wasmResponse.arrayBuffer();
      return await WebAssembly.compile(wasmBuffer);
    }
  ];
};
var $3f177c34ffa911f6$exports = {};
$parcel$export($3f177c34ffa911f6$exports, "Event", () => $3f177c34ffa911f6$export$d61e24a684f9e51);
var $3f177c34ffa911f6$export$d61e24a684f9e51 = class {
  constructor(_value = "", _checked = false) {
    this._value = _value;
    this._checked = _checked;
  }
  preventDefault() {
  }
  stopPropagation() {
  }
  value() {
    return this._value;
  }
  checked() {
    return this._checked;
  }
};
var $0e97ad6bdcaa9a3e$var$nodes = /* @__PURE__ */ new Map();
function $0e97ad6bdcaa9a3e$export$6955262f0426a66b() {
  console.debug(`[clearNodes] Clearing ${$0e97ad6bdcaa9a3e$var$nodes.size} nodes`);
  $0e97ad6bdcaa9a3e$var$nodes.clear();
}
function $0e97ad6bdcaa9a3e$export$5833d9be8010042a(id, callback) {
  console.debug(`[setHook] Setting "${callback}" hook on node ${id}`);
  const node = $0e97ad6bdcaa9a3e$var$nodes.get(id);
  if (node) {
    node.hooks = node.hooks || [];
    node.hooks.push(callback);
  }
}
function $0e97ad6bdcaa9a3e$export$2bfbd9808f953be9(element, props, children) {
  const id = crypto.randomUUID();
  console.debug(`[dfunc] Creating node: element="${element}", id=${id}`);
  $0e97ad6bdcaa9a3e$var$nodes.set(id, {
    element,
    props,
    children
  });
  return id;
}
function $0e97ad6bdcaa9a3e$export$f570cabd7d9ab9b(msg) {
  console.debug("UI LOG:", msg);
}
function $0e97ad6bdcaa9a3e$export$431694b633b87558(id, emitEvent, navigate) {
  const node = $0e97ad6bdcaa9a3e$var$nodes.get(id);
  if (!node) {
    console.debug(`[createDomFromIdRec] Text node: "${id}"`);
    return id;
  }
  const data = {};
  if (node.props) {
    data.props = {};
    for (const prop of node.props.prop) data.props[prop.key] = prop.value;
    data.on = {};
    for (const eventType of node.props.on) data.on[eventType] = (e) => {
      console.debug(`[event] "${eventType}" on node ${id}`);
      emitEvent(id, eventType, new (0, $3f177c34ffa911f6$export$d61e24a684f9e51)(e?.currentTarget?.value, e?.currentTarget?.checked));
    };
    const href = data.props["href"];
    if (href && !data.on["click"]) {
      if (navigate) data.on.click = (e) => {
        e.preventDefault();
        navigate(href);
      };
    }
  }
  if (node.hooks && node.hooks.length > 0) {
    console.debug(`[createDomFromIdRec] Node ${id} has ${node.hooks.length} hooks: ${node.hooks.join(", ")}`);
    data.hook = {};
    for (const hookName of node.hooks) data.hook[hookName] = () => {
      console.debug(`[hook] "${hookName}" fired for node ${id}`);
      emitEvent(id, hookName, new (0, $3f177c34ffa911f6$export$d61e24a684f9e51)());
    };
  }
  const ch = [];
  if (node.children) for (const childId of node.children) {
    const childEl = $0e97ad6bdcaa9a3e$export$431694b633b87558(childId, emitEvent, navigate);
    ch.push(childEl);
  }
  return (0, h)(node.element, data, ch);
}
var $36561bb1074897e9$exports = {};
$parcel$export($36561bb1074897e9$exports, "setCb", () => $36561bb1074897e9$export$f4651a9718246ed1);
$parcel$export($36561bb1074897e9$exports, "PromiseToResult", () => $36561bb1074897e9$export$e36240994a645832);
var $36561bb1074897e9$var$cb;
var $36561bb1074897e9$var$pending = [];
var $36561bb1074897e9$var$dispatch = (id, result) => {
  if ($36561bb1074897e9$var$cb) {
    $36561bb1074897e9$var$cb(id, result);
    return;
  }
  $36561bb1074897e9$var$pending.push({
    id,
    result
  });
};
var $36561bb1074897e9$export$f4651a9718246ed1 = (callback) => {
  $36561bb1074897e9$var$cb = callback;
  if ($36561bb1074897e9$var$pending.length === 0) return;
  while ($36561bb1074897e9$var$pending.length > 0) {
    const { id, result } = $36561bb1074897e9$var$pending.shift();
    $36561bb1074897e9$var$cb(id, result);
  }
};
var $36561bb1074897e9$export$e36240994a645832 = (promiseFn) => {
  return (...args) => {
    const id = crypto.randomUUID();
    promiseFn(...args).then((result) => {
      $36561bb1074897e9$var$dispatch(id, {
        tag: "ok",
        val: result
      });
    }).catch((error) => {
      $36561bb1074897e9$var$dispatch(id, {
        tag: "err",
        val: error instanceof Error ? error.message : String(error)
      });
    });
    return id;
  };
};
function $7ecf692fb720ca8d$export$bef1f36f5486a6a3(msg) {
  (0, $0e97ad6bdcaa9a3e$export$f570cabd7d9ab9b)(msg);
}
var $7ecf692fb720ca8d$export$6874335aa33ac2fe = class extends HTMLElement {
  connectedCallback() {
    this._connected = true;
    if (this.rootComponent) {
      this.rerender();
      return;
    }
    this.reloadComponent();
  }
  disconnectedCallback() {
    this._connected = false;
  }
  reloadComponent() {
    if (!this._connected) {
      console.warn("Component not connected, skipping reload.");
      return;
    }
    const entrypoint = this._entrypoint;
    if (!entrypoint) {
      console.warn("No entrypoint attribute set.");
      return;
    }
    if (!this.loader) {
      console.warn("No file loader set.");
      return;
    }
    this.reloadGeneration++;
    console.debug(`[reloadComponent] Starting reload, generation: ${this.reloadGeneration}`);
    (0, $0e97ad6bdcaa9a3e$export$6955262f0426a66b)();
    if (this._sandbox) (0, $afa3b9af1178429b$export$76f430ef6626d809)(entrypoint, this.loader).then(([moduleUrl, compile]) => {
      this.loadEntrypointFromWasmUrl(moduleUrl, compile);
    }).catch((e) => {
      console.error("Failed to load and transpile entrypoint:", e);
    });
    else this.loadEntrypointFromJavaScriptUrl(entrypoint);
  }
  getWrapper() {
    return this.wrapperEl;
  }
  set fileloader(loader) {
    this.loader = loader;
    this.reloadComponent();
  }
  set extensionObject(obj) {
    this._extensionObject = obj;
  }
  set entrypoint(entrypoint) {
    this._entrypoint = entrypoint;
    this.reloadComponent();
  }
  set sandbox(sandbox) {
    this._sandbox = sandbox;
    this.reloadComponent();
  }
  set routeStrategy(strategy) {
    this._routeStrategy = strategy;
    this.rerender();
  }
  static get observedAttributes() {
    return [
      "entrypoint",
      "path",
      "profile",
      "css",
      "style",
      "no-sandbox"
    ];
  }
  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case "no-sandbox":
        this._sandbox = newValue !== "true";
        break;
      case "entrypoint":
        this.entrypoint = newValue;
        break;
      case "path":
        if (oldValue) this.rerender();
        break;
      case "profile":
        this.profile = newValue === "true";
        break;
      case "style":
        const htmlString = newValue;
        const styleEl = document.createElement("style");
        styleEl.textContent = htmlString.trim();
        const lastLink = Array.from(this.shadow.querySelectorAll('link[rel="stylesheet"]')).pop();
        const existingStyles = this.shadow.querySelectorAll("style");
        existingStyles.forEach((style) => style.remove());
        if (lastLink) this.shadow.insertBefore(styleEl, lastLink.nextSibling);
        else this.shadow.insertBefore(styleEl, this.shadowRoot?.firstChild || null);
        break;
      case "css":
        const css = newValue.split(",");
        const existingLinks = this.shadow.querySelectorAll('link[rel="stylesheet"]');
        existingLinks.forEach((link) => link.remove());
        for (const comp of css) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = comp;
          this.shadow.insertBefore(link, this.shadowRoot?.firstChild || null);
        }
        break;
    }
  }
  constructor() {
    super(), this.profile = false, this.currentVNode = null, this._routeStrategy = new (0, $47d6f20d5f21b2bd$export$ec331118eb897269)(), this.loader = new (0, $4195f124d99f64a1$export$c104e8094d57b0fc)(), this._sandbox = true, this._extensionObject = {}, this._connected = false, this.reloadGeneration = 0;
    this.shadow = this.attachShadow({
      mode: "open"
    });
    this.wrapperEl = document.createElement("div");
    this.wrapperEl.classList.add("druid-wrapper");
    this.mountEl = document.createElement("div");
    this.mountEl.classList.add("druid-mount");
    this.mountEl.innerText = "Transpiling...";
    this.wrapperEl.appendChild(this.mountEl);
    this.shadow.appendChild(this.wrapperEl);
  }
  getExtensionObject() {
    return {
      "druid:ui/ui": {
        d: (element, props, children) => {
          return (0, $0e97ad6bdcaa9a3e$export$2bfbd9808f953be9)(element, props, children);
        },
        log: (msg) => {
          (0, $0e97ad6bdcaa9a3e$export$f570cabd7d9ab9b)(msg);
        },
        rerender: () => {
          setTimeout(() => this.rerender(), 0);
        },
        setHook: (0, $0e97ad6bdcaa9a3e$export$5833d9be8010042a)
      },
      "druid:ui/utils": {
        Event: (0, $3f177c34ffa911f6$export$d61e24a684f9e51)
      },
      ...this._extensionObject
    };
  }
  async loadEntrypointFromJavaScriptUrl(entrypoint) {
    const loadGeneration = this.reloadGeneration;
    console.debug(`[loadEntrypointFromJavaScriptUrl] Starting load for generation ${loadGeneration}`);
    window["druid-extension"] = this.getExtensionObject();
    const response = await this.loader.load(entrypoint, {
      cache: false
    });
    const bundleContent = response.buffer;
    const blob = new Blob([
      bundleContent
    ], {
      type: "application/javascript"
    });
    const moduleUrl = URL.createObjectURL(blob);
    const t = await import(
      /* @vite-ignore */
      moduleUrl
    );
    console.debug(`[loadEntrypointFromJavaScriptUrl] Module loaded for generation ${loadGeneration}, current generation: ${this.reloadGeneration}`);
    (0, $36561bb1074897e9$export$f4651a9718246ed1)(t.component.asyncComplete);
    if (this.reloadGeneration !== loadGeneration) {
      console.debug(`[loadEntrypointFromJavaScriptUrl] Aborting stale load (generation ${loadGeneration}, current: ${this.reloadGeneration})`);
      URL.revokeObjectURL(moduleUrl);
      return;
    }
    this.rootComponent = t;
    this.currentVNode = null;
    console.debug(`[loadEntrypointFromJavaScriptUrl] Rendering generation ${loadGeneration}`);
    this.rerender();
    URL.revokeObjectURL(moduleUrl);
  }
  async loadEntrypointFromWasmUrl(entrypoint, loadCompile) {
    const t = await import(
      /* @vite-ignore */
      entrypoint
    );
    URL.revokeObjectURL(entrypoint);
    const i = await t.instantiate(loadCompile, this.getExtensionObject());
    (0, $36561bb1074897e9$export$f4651a9718246ed1)(i.component.asyncComplete);
    this.rootComponent = i;
    this.rerender();
  }
  rerender() {
    if (!this.rootComponent) {
      console.warn("Root component not initialized yet.");
      return;
    }
    let renderStart;
    if (this.profile)
      renderStart = performance.now();
    const rootId = this.rootComponent.component.init({
      path: this._routeStrategy.getCurrentPath()
    });
    if (this.profile) {
      const initEnd = performance.now();
      console.debug(`Init completed in ${(initEnd - renderStart).toFixed(2)} ms`);
    }
    this.mountEl.innerHTML = "";
    const dom = (0, $0e97ad6bdcaa9a3e$export$431694b633b87558)(rootId, (nodeId, eventType, e) => {
      this.rootComponent.component.emit(nodeId, eventType, e);
      const generation = this.reloadGeneration;
      setTimeout(() => {
        if (this.reloadGeneration === generation) this.rerender();
        else console.debug(`[setTimeout] Skipping stale rerender (generation ${generation}, current: ${this.reloadGeneration})`);
      }, 0);
    }, (href) => {
      this._routeStrategy.navigateTo(href);
      this.rerender();
    });
    if (dom instanceof String) {
      console.warn("Root DOM is a string, cannot render:", dom);
      return;
    }
    if (this.currentVNode) (0, $7705509af6e2b475$export$b76953f99ab2be78)(this.currentVNode, dom);
    else (0, $7705509af6e2b475$export$b76953f99ab2be78)(this.mountEl, dom);
    this.currentVNode = dom;
    if (this.profile) {
      const renderEnd = performance.now();
      console.debug(`Render completed in ${(renderEnd - renderStart).toFixed(2)} ms`);
    }
  }
};
customElements.define("druid-ui", $7ecf692fb720ca8d$export$6874335aa33ac2fe);

// ../../packages/vite/dist/client.js
var ViteHMR = (druidUiElement2) => {
  if (import.meta.hot) {
    console.log("HMR enabled");
    import.meta.hot.on("ui-update", (data) => {
      const reason = data?.reason;
      console.log("UI update:", reason);
      druidUiElement2.reloadComponent();
    });
  }
};

// src/main.ts
var druidUiElement = new $7ecf692fb720ca8d$export$6874335aa33ac2fe();
druidUiElement.extensionObject = {
  "druid:ui/extension": {
    requestGet: $36561bb1074897e9$export$e36240994a645832(async (url) => {
      const res = await fetch(url);
      return res.text();
    })
  }
};
druidUiElement.sandbox = false;
druidUiElement.setAttribute("entrypoint", "/extended.bundled.js");
druidUiElement.setAttribute("profile", "true");
var app = document.getElementById("app");
app?.appendChild(druidUiElement);
ViteHMR(druidUiElement);
