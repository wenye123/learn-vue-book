// 这里的设定 childre只是是string 或者节点数组(节点数组里面不能带有文本)

(() => {
  const { effect, ref } = VueReactivity;

  // 为了保持通用 特殊api通过参数传递
  function createRenderer(options) {
    const { createElement, setElementText, insert, patchProps } = options;

    // 卸载vnode
    function _unmount(vnode) {
      const parent = vnode.el.parentNode;
      if (parent) {
        parent.removeChild(vnode.el);
      }
    }

    // 挂载vnode
    function _mountElement(vnode, container) {
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

    // 更新子节点
    function _patchChildren(oldNode, newNode, el) {
      if (typeof newNode.children === "string") {
        // 新节点是文本节点
        // 旧节点是节点数组 则先循环卸载
        if (Array.isArray(oldNode)) {
          oldNode.children.forEach((vnode) => {
            _unmount(vnode);
          });
        }
        // 最后更新节点值
        setElementText(el, newNode.children);
      } else if (Array.isArray(newNode.children)) {
        // 新节点是节点数组
        // 旧节点也是节点数组则diff算法
        if (Array.isArray(oldNode.children)) {
          // 最简单的做法就是 全部卸载旧节点 然后挂载新节点
          oldNode.children.forEach((vnode) => {
            _unmount(vnode);
          });
          newNode.children.forEach((vnode) => {
            patch(null, vnode, el);
          });
        } else {
          // 旧节点是文本节点或不存在 则直接清空内容后 重新挂载节点
          setElementText(el, "");
          newNode.children.forEach((vnode) => {
            patch(null, vnode, el);
          });
        }
      } else {
        // 新节点不存在
        // 旧节点是数组节点则循环卸载
        if (Array.isArray(oldNode.children)) {
          oldNode.children.forEach((vnode) => {
            _unmount(vnode);
          });
        } else if (typeof oldNode.children === "string") {
          // 旧节点是文本节点 则清空内容
          setElementText(el, "");
        }
        // 旧节点也不存在则什么也不做
      }
    }

    // 更新vnode
    function _patchElement(oldNode, newNode) {
      // 将旧节点的el属性赋值给新节点
      const el = (newNode.el = oldNode.el);
      // 更新props 更新新属性存在且不相同的 删除不存在的
      const oldProps = oldNode.props;
      const newProps = newNode.props;
      for (let key in newProps) {
        if (oldProps[key] !== newProps[key]) {
          patchProps(el, key, oldProps[key], newProps[key]);
        }
      }
      for (let key in oldProps) {
        if (!(key in newProps)) {
          patchProps(el, key, oldProps[key], null);
        }
      }
      // 更新children
      _patchChildren(oldNode, newNode, el);
    }

    // 新增和更新都算patch
    function patch(oldNode, newNode, container) {
      if (oldNode && oldNode.type !== newNode.type) {
        _unmount(oldNode);
        oldNode = null;
      }

      const { type } = newNode;
      if (typeof type === "string") {
        // 普通标签元素的挂载
        // 老节点不存在则是新增(挂载) 否则是更新
        if (!oldNode) {
          _mountElement(newNode, container);
        } else {
          // 更新操作
          _patchElement(oldNode, newNode);
        }
      } else if (typeof type === "object") {
        // 组件类型的挂载
      } else {
        // 其他类型的挂载
      }
    }

    // 渲染函数
    function render(vnode, container) {
      if (vnode) {
        // 新节点存在则进行patch
        patch(container._vnode, vnode, container);
      } else {
        // 不存在且_vnode存在则清空操作
        if (container._vnode) {
          _unmount(container._vnode);
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
              // 绑定事件比触发时间晚则不触发
              if (e.timeStamp < el._vei[key].attached) return;
              // 数组循环调用 否则直接调用
              if (Array.isArray(el._vei[key].value)) {
                el._vei[key].value.forEach((fn) => fn(e));
              } else {
                el._vei[key].value(e);
              }
            };
            // 赋值.value的值
            el._vei[key].value = newVal;
            // 赋值绑定时间时间
            el._vei[key].attached = performance.now();
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

  const count = ref(0);
  effect(() => {
    const vnode = {
      type: "div",
      children: [
        {
          type: "p",
          props: {
            onClick() {
              count.value++;
            },
          },
          children: count.value + "",
        },
      ],
    };
    renderer.render(vnode, document.body);
  });
})();
