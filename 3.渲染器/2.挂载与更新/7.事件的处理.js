(() => {
  const { effect, ref } = VueReactivity;

  // 为了保持通用 特殊api通过参数传递
  function createRenderer(options) {
    const { createElement, setElementText, insert, patchProps } = options;

    // 卸载
    function unmount(vnode) {
      const parent = vnode.el.parentNode;
      if (parent) {
        parent.removeChild(vnode.el);
      }
    }

    // 挂载
    function mountElement(vnode, container) {
      // 根据vnode创建DOM并赋值给el属性
      const el = (vnode.el = createElement(vnode.type));
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
      if (oldNode && oldNode.type !== newNode.type) {
        unmount(oldNode);
        oldNode = null;
      }

      const { type } = newNode;
      if (typeof type === "string") {
        // 普通标签元素的挂载
        // 老节点不存在则是新增(挂载) 否则是更新
        if (!oldNode) {
          mountElement(newNode, container);
        } else {
          // 更新操作
        }
      } else if (typeof type === "object") {
        // 组件类型的挂载
      } else {
        // 其他类型的挂载
      }
    }

    function render(vnode, container) {
      if (vnode) {
        // 新节点存在则进行patch
        patch(container._vnode, vnode, container);
      } else {
        // 不存在且_vnode存在则清空操作
        if (container._vnode) {
          unmount(container._vnode);
        }
      }
      // 将新节点挂载在容器中
      container._vnode = vnode;
    }

    return {
      render,
    };
  }

  // 自己编写: 格式化class
  function normalizeClass(obj, str = "") {
    if (typeof obj == "string") {
      str += ` ${obj}`;
    } else if (Object.prototype.toString.call(obj) === "[object Object]") {
      for (let key in obj) {
        if (obj[key]) str += ` ${key}`;
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item) => {
        str = normalizeClass(item, str);
      });
    }
    return str.trim();
  }

  const vnode = {
    type: "input",
    props: {
      id: "name", // 存在dom属性
      // disabled: "", // 空字符串则为dom属性设置为true
      class: normalizeClass(["wenye", { name: true, age: false }, "erye"]), // 不存在dom属性
      form: "xxx", // 只读属性 只能用setAttribute
      onClick: [
        () => {
          alert("click1");
        },
        () => {
          alert("click2");
        },
      ],
      onMouseOver() {
        alert("mouseOver");
      },
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
      if (/^on/.test(key)) {
        // on开头的是事件属性
        // 获取事件名
        const name = key.slice(2).toLowerCase();
        // 将伪事件结构挂载到el的_vei属性上
        if (!el._vei) el._vei = {};
        // 存在新事件则绑定或更新
        if (newVal) {
          if (!el._vei[key]) {
            // 不存在当前时间则创建 执行时候会触发.value真正事件
            el._vei[key] = (e) => {
              // 数组循环调用 否则直接调用
              if (Array.isArray(el._vei[key].value)) {
                el._vei[key].value.forEach((fn) => fn(e));
              } else {
                el._vei[key].value(e);
              }
            };
            // 复制.value的值
            el._vei[key].value = newVal;
            // 绑定事件
            el.addEventListener(name, el._vei[key]);
          } else {
            // 更新事件
            el._vei[key].value = newVal;
          }
        } else if (el._vei[key]) {
          // 不存在新事件 且之前伪事件函数存在则卸载
          el.removeEventListener(name, el._vei[key]);
        }
      } else if (key === "class") {
        el.className = newVal || "";
      }
      // 存在dom属性则直接设置 注意''需要转换成true
      else if (shouldSetAsDomProp(el, key, newVal)) {
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
