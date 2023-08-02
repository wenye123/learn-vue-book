(() => {
  const { effect, ref } = VueReactivity;

  // 为了保持通用 特殊api通过参数传递
  function createRenderer(options) {
    const { createElement, setElementText, insert, patchProps } = options;

    // 挂载
    function mountElement(vnode, container) {
      const el = createElement(vnode.type);
      // 文本节点则直接插入值
      if (typeof vnode.children === "string") {
        setElementText(el, vnode.children);
      } else if (Array.isArray(vnode.children)) {
        // 数组则循环调用
        vnode.children.forEach((child) => {
          patch(null, child, el);
        });
      }

      // 插入属性值 存在则遍历设置
      if (vnode.props) {
        for (const key in vnode.props) {
          patchProps(el, key, null, vnode.props[key]);
        }
      }

      // 插入容器
      insert(el, container);
    }

    // 新增和更新都算patch
    function patch(oldNode, newNode, container) {
      // 老节点不存在则是新增(挂载) 否则是更新
      if (!oldNode) {
        mountElement(newNode, container);
      } else {
        // 更新操作
      }
    }

    function render(vnode, container) {
      if (vnode) {
        // 新节点存在则进行patch
        patch(container._vnode, vnode, container);
      } else {
        // 不存在则清空操作
        container.innerHTML = "";
      }
      // 将新节点挂载在容器中
      container._vnode = vnode;
    }

    return {
      render,
    };
  }

  const vnode = {
    type: "input",
    props: {
      id: "name", // 存在dom属性
      disabled: "", // 空字符串则为dom属性设置为true
      class: "u-name", // 不存在dom属性
      form: "xxx", // 只读属性 只能用setAttribute
    },
    children: "test",
  };
  function shouldSetAsDomProp(el, key, value) {
    // 特殊处理
    if (key === "form" && el.tagName === "INPUT") return false;
    // 兜底
    return key in el;
  }
  const renderer = createRenderer({
    // 创建元素
    createElement(tag) {
      return document.createElement(tag);
    },
    // 设置元素文本节点
    setElementText(el, text) {
      el.textContent = text;
    },
    // 添加元素 这里采用insertBefore anchor是null则起到appendChild的效果 一举两得
    insert(el, parent, anchor = null) {
      parent.insertBefore(el, anchor);
    },
    // 设置属性
    patchProps(el, key, oldVal, newVal) {
      // 存在dom属性则直接设置 注意''需要转换成true
      if (shouldSetAsDomProp(el, key, newVal)) {
        if (typeof el[key] === "boolean" && newVal === "") {
          el[key] = true;
        } else {
          el[key] = newVal;
        }
      } else {
        // 没有dom属性则用setAttribute设置
        el.setAttribute(key, newVal);
      }
    },
  });
  renderer.render(vnode, document.body);
})();
