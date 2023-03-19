(() => {
  // 挂载元素
  function mountedElement(vnode, container) {
    const el = document.createElement(vnode.tag);
    // 添加属性
    for (let key in vnode.props) {
      // 添加事件
      if (/^on/.test(key)) {
        el.addEventListener(key.substr(2).toLowerCase(), vnode.props[key]);
      } else {
        el.setAttribute(key, vnode.props[key]);
      }
    }
    // 处理children
    if (typeof vnode.children === "string") {
      const text = document.createTextNode(vnode.children);
      el.appendChild(text);
    } else if (Array.isArray(vnode.children)) {
      // 数组则递归
      vnode.children.forEach((child) => {
        if (typeof child === "string") {
          const text = document.createTextNode(child);
          el.appendChild(text);
        } else if (typeof child === "object") {
          render(child, el);
        }
      });
    }
    // 添加到容器中
    container.appendChild(el);
  }
  // 挂载组件
  function mountedComponent(vnode, container) {
    // 调用函数获取虚拟DOM
    const subtree = vnode.tag.setup()();
    // 递归渲染
    render(subtree, container);
  }
  // 渲染函数
  function render(vnode, container) {
    if (typeof vnode.tag === "string") {
      mountedElement(vnode, container);
    } else if (typeof vnode.tag === "object") {
      mountedComponent(vnode, container);
    }
  }

  //---- 同构渲染相关函数 --------------

  // 转义html字符
  const escapeMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  function escapeHtml(str) {
    let arr = [...str];
    for (let i = 0; i <= arr.length; i++) {
      const escape = escapeMap[str[i]];
      if (escape) {
        arr[i] = escape;
      }
    }
    return arr.join("");
  }

  // 是否布尔属性
  const isBooleanAttr = (key) =>
    `itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly,async,autofocus,autoplay,controls,default,defer,disabled,hidden,loop,open,required,reversed,scoped,seamless,checked,muted,multiple,selected`
      .split(",")
      .includes(key);
  // 是否合法属性名
  const isSSRSafeAttrName = (key) =>
    !/[>/="'\u0009\u000a\u000c\u0020]/.test(key);
  // 渲染动态属性
  function _renderDyminacAtrr(key, val) {
    if (isBooleanAttr(key)) {
      // 布尔属性 如果是false则不渲染 否则只渲染一个key
      return val === false ? "" : ` ${key}`;
    } else if (isSSRSafeAttrName(key)) {
      // 合法属性名 如果没有属性值则渲染一个属性名 有值则需要转义
      return val === "" ? ` ${key}` : ` ${key}="${escapeHtml(val)}"`;
    } else {
      // 跳过渲染不安全属性
      console.warn(
        `[@vue/server-renderer] Skipped rendering unsafe attribute name: ${key}`
      );
      return "";
    }
  }
  // 渲染属性
  const shouldIgnoreProp = ["key", "ref"];
  function _renderAttr(props) {
    let html = "";
    for (let key in props) {
      if (shouldIgnoreProp.includes(key) || /^on[^a-z]/.test(key)) {
        continue;
      } else {
        // html += ` ${key}="${props[key]}"`;
        html += _renderDyminacAtrr(key, props[key]);
      }
    }
    return html;
  }

  // 渲染元素节点
  const VOID_TAGS =
    "area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr".split(
      ","
    ); // 自闭合标签
  function renderElementVnode(vnode) {
    const { tag, props, children } = vnode;
    const isVoidTag = VOID_TAGS.includes(tag); // 是否自闭合标签
    // 开始标签
    let html = `<${tag}`;
    // 属性
    if (props) {
      html += _renderAttr(props);
    }
    // 闭合标签
    html += isVoidTag ? "/>" : ">";
    // 空标签无需处理子节点 直接返回
    if (isVoidTag) return html;
    // 处理子节点
    if (typeof children === "string") {
      html += escapeHtml(children);
    } else if (Array.isArray(children)) {
      children.forEach((child) => {
        html += renderElementVnode(child);
      });
    }
    // 结束标签
    html += `</${tag}>`;
    // 返回html字符串
    return html;
  }

  // 渲染组件节点
  // 注意: 和书中不一样 精简很多
  function renderComponentVnode(comVnode) {
    const { setup, data, beforeCreate, created } = comVnode.tag;
    const { props } = comVnode;

    // 钩子
    beforeCreate && beforeCreate();
    // 实例
    const state = data ? data() : null;
    const slots = comVnode.children || {};
    const comIns = {
      state,
      props,
      slots,
    };
    comVnode.comIns = comIns;
    // 渲染上下文
    const renderContext = new Proxy(comIns, {
      get(t, k, r) {
        const { state, props, slots } = t;
        if (k === "$slots") return slots;
        if (state && k in state) {
          return state[k];
        } else if (k in props) {
          return props[k];
        } else {
          console.error("不存在");
        }
      },
      set(t, k, v, r) {
        const { state, props } = t;
        if (state && k in state) {
          state[k] = v;
        } else if (k in props) {
          props[k] = v;
        } else {
          console.error("不存在");
        }
      },
    });

    const render = setup(props, renderContext);
    // 钩子
    created && created();

    const subTree = render.call(renderContext, renderContext);
    return renderElementVnode(subTree);
  }

  // 渲染节点
  function renderVNode(vnode) {
    const tag = vnode.tag;
    if (typeof tag === "string") {
      return renderElementVnode(vnode);
    } else if (typeof tag === "object") {
      return renderComponentVnode(vnode);
    } else {
      // 其他类型 text fragment啥的
    }
  }

  /*******************例子*********************/
  // 虚拟DOM-元素
  const elementVnode = {
    tag: "span",
    props: {
      key: "文本节点",
      ref: "span",
      class: "<m-text>",
      checked: true,
      onClick: () => alert("hello"),
    },
    children: [
      {
        tag: "span",
        children: "<click> ",
      },
      {
        tag: "img",
        props: {
          width: "50px",
          src: "https://pica.zhimg.com/v2-baf7191e78a25d807b09e1bc01f72817_l.jpg?source=32738c0c",
        },
      },
      {
        tag: "span",
        children: "me",
      },
    ], // children的值可以是一个字符串 也可以是一个数组
  };
  // 虚拟DOM-组件
  const MyComponent = {
    beforeCreate() {
      console.log("--beforeCreate--");
    },
    setup(props, setupContext) {
      return function () {
        return {
          tag: "div",
          children: [
            {
              tag: "span",
              children: "组件: " + this.title,
            },
            elementVnode,
          ],
        };
      };
    },
  };
  const componentVnode = {
    tag: MyComponent,
    props: {
      title: "温叶",
    },
  };
  render(componentVnode, document.body);

  // 渲染元素节点为字符串
  // const elementVnodeHtml = renderElementVnode(elementVnode);
  // console.log("元素节点html", elementVnodeHtml);
  // 渲染组件
  // const comVnodeHtml = renderComponentVnode(componentVnode);
  // console.log("组件节点html", elementVnodeHtml);

  // 最终写法: 渲染节点
  const vnodeHtml = renderVNode(componentVnode);
  console.log("最终写法html", vnodeHtml);
  document.querySelector("#app2").innerHTML = vnodeHtml;
})();
