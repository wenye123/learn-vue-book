(() => {
  const { effect, reactive, ref } = VueReactivity;

  const Text = Symbol();
  const Comment = Symbol();
  const Fragment = Symbol();

  // 为了保持通用 特殊api通过参数传递
  function createRenderer(options) {
    const {
      createElement,
      setElementText,
      insertElement,
      patchProps,
      createTextElement,
      setTextElement,
    } = options;

    // 卸载vnode
    function _unmountNode(vnode) {
      // 空白节点直接卸载children
      if (vnode.type === Fragment) {
        return vnode.children.forEach((vnode) => _unmountNode(vnode));
      }

      const parent = vnode.el.parentNode;
      if (parent) {
        parent.removeChild(vnode.el);
      }
    }

    // 挂载元素节点
    function _mountElementNode(vnode, container, anchor) {
      // 根据vnode创建DOM并赋值给el属性
      const el = (vnode.el = createElement(vnode.type));

      // 挂载children
      if (typeof vnode.children === "string") {
        // 文本直接写入
        setElementText(el, vnode.children);
      } else if (Array.isArray(vnode.children)) {
        // 节点数组则循环调用
        vnode.children.forEach((child) => {
          patch(null, child, el);
        });
      }

      // 挂载props
      if (vnode.props) {
        for (const key in vnode.props) {
          patchProps(el, key, null, vnode.props[key]);
        }
      }

      // 插入容器
      insertElement(el, container, anchor);
    }

    // 更新子节点
    function _patchChildren(oldNode, newNode, el) {
      if (typeof newNode.children === "string") {
        // 新节点是文本节点
        // 旧节点是节点数组 则先循环卸载
        if (Array.isArray(oldNode)) {
          oldNode.children.forEach((vnode) => {
            _unmountNode(vnode);
          });
        }
        // 最后更新节点值
        setElementText(el, newNode.children);
      } else if (Array.isArray(newNode.children)) {
        // 新节点是节点数组
        // 旧节点也是节点数组则diff算法
        if (Array.isArray(oldNode.children)) {
          const oldChildren = oldNode.children;
          const newChildren = newNode.children;

          // 遍历新的子节点 在老节点中找到key相同的 进行更新
          let currMaxOldIndex = 0;
          for (let [i, nNode] of newChildren.entries()) {
            let find = false; // 是否找到对应的节点
            for (let [j, oNode] of oldChildren.entries()) {
              if (nNode.key === oNode.key) {
                // 标记找到对应节点
                find = true;
                // 找到节点则直接更新
                patch(oNode, nNode, el);
                // 如果对应最大老节点索引值大于当前老节点索引 说明需要移动位置
                if (currMaxOldIndex > j) {
                  // 获取前一个节点并插入
                  const prevNode = newChildren[i - 1];
                  if (prevNode) {
                    const anchor = prevNode.el.nextSibling;
                    insertElement(oNode.el, el, anchor);
                  }
                } else {
                  // 更新currMaxOldIndex值
                  currMaxOldIndex = j;
                }

                // 找到节点后跳出当前循环
                break;
              }
            }
            // 没找到对应节点则新增
            if (find === false) {
              const prevNode = newChildren[i - 1];
              let anchor = null;
              if (!prevNode) {
                anchor = el.firstChild;
              } else {
                anchor = prevNode.el.nextSibling;
              }
              patch(null, nNode, el, anchor);
            }
          }

          // 最后遍历老节点 如果在新节点中不存在则删除老节点
          for (let oNode of oldChildren) {
            const vnode = newChildren.find((vnode) => vnode.key === oNode.key);
            if (!vnode) {
              _unmountNode(oNode);
            }
          }
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
            _unmountNode(vnode);
          });
        } else if (typeof oldNode.children === "string") {
          // 旧节点是文本节点 则清空内容
          setElementText(el, "");
        }
        // 旧节点也不存在则什么也不做
      }
    }

    // 更新块节点的子节点
    function _patchBlockChildren(oldNode, newNode) {
      // 只更新动态节点
      for (let i = 0; i < newNode.dynamicChildren.length; i++) {
        _patchElementNode(
          oldNode.dynamicChildren[i],
          newNode.dynamicChildren[i]
        );
      }
    }

    // 更新元素节点
    function _patchElementNode(oldNode, newNode) {
      // 将旧节点的el属性赋值给新节点
      const el = (newNode.el = oldNode.el);

      // 存在更新标记则靶向更新
      if (newNode.patchFlags) {
        if (newNode.patchFlags.includes(1)) {
          // 只更新文本
          // 什么也不用做
        } else if (newNode.patchFlags.includes(1)) {
          // 更新class
        }
        // 其他标记情况
      } else {
        // 全量更新
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
      }

      // 如果存在动态子节点则直接更新动态子节点
      if (newNode.dynamicChildren) {
        _patchBlockChildren(oldNode, newNode);
      } else {
        // 更新children
        _patchChildren(oldNode, newNode, el);
      }
    }

    // 新增和更新都算patch oldNode不存在就是新增
    // oldNode: vnode | null; newNode: vnode
    function patch(oldNode, newNode, container, anchor) {
      // 老节点存在且类型都变了 直接卸载老节点重新挂载
      if (oldNode && oldNode.type !== newNode.type) {
        _unmountNode(oldNode);
        oldNode = null;
      }

      const { type } = newNode;
      if (typeof type === "string") {
        // 普通标签元素的挂载
        // 老节点不存在则是新增(挂载) 否则是更新
        if (!oldNode) {
          _mountElementNode(newNode, container, anchor);
        } else {
          // 更新操作
          _patchElementNode(oldNode, newNode);
        }
      } else if (type === Text) {
        // 文本节点
        // 如果旧节点不存在则直接挂载 存在则更新内容
        if (!oldNode) {
          const el = (newNode.el = createTextElement(newNode.children));
          insertElement(el, container);
        } else {
          const el = (newNode.el = oldNode.el);
          if (oldNode.children !== newNode.children) {
            setTextElement(el, newNode.children);
          }
        }
      } else if (type === Comment) {
        // 注释节点 同文本节点 只不过改成createComment
      } else if (type === Fragment) {
        // 空白节点 老节点不存在则直接挂载 存在则更新子节点
        if (!oldNode) {
          newNode.children.forEach((vnode) => {
            patch(null, vnode, container);
          });
        } else {
          _patchChildren(oldNode, newNode, container);
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
          _unmountNode(container._vnode);
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
  // 是否应该作为DOM属性
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
    insertElement(el, parent, anchor = null) {
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
    // 创建文本节点
    createTextElement(text) {
      return document.createTextNode(text);
    },
    // 设置文本节点
    setTextElement(el, text) {
      el.nodeValue = text;
    },
  });

  // 动态子节点栈
  const dynamicChildrenStack = [];
  // 当前动态子节点
  let currDynamicChildren = null;
  // 打开block节点
  function openBlock() {
    // 设置当前动态子节点为空数组 推进栈中
    dynamicChildrenStack.push((currDynamicChildren = []));
  }
  // 关闭block节点
  function closeBlock() {
    // 弹出栈顶 作为当前动态子节点
    currDynamicChildren = dynamicChildrenStack.pop();
  }

  // 创建节点
  function h(type, props, children, patchFlags) {
    const key = props && props.key;
    props && delete props.key;

    const vnode = {
      type,
      key,
      props,
      children,
      patchFlags,
    };

    // 如果存在标记则是动态节点 添加到当前动态子节点数组中
    if (patchFlags && currDynamicChildren) {
      currDynamicChildren.push(vnode);
    }

    return vnode;
  }
  // 创建block节点
  function hBlock(type, props, children) {
    const block = h(type, props, children);
    block.dynamicChildren = currDynamicChildren;
    // 关闭block
    closeBlock();
    return block;
  }

  /******************例子********************/
  {
    // 使用队列控制执行次数
    const jobQueue = new Set();
    const p = Promise.resolve();
    let isFlushing = false; // 是否正在刷新队列
    function flushJob() {
      if (isFlushing) return;
      isFlushing = true;
      p.then(() => {
        jobQueue.forEach((job) => job());
      }).finally(() => {
        isFlushing = false;
      });
    }

    let count = ref(0);

    // 模拟模板渲染函数
    function comRender() {
      // 打开block
      openBlock();
      // 根节点用hBlock
      return hBlock("div", { key: "根节点" }, [
        h(
          "p",
          {
            key: "静态节点",
            onClick() {
              count.value++;
            },
          },
          "静态节点，点击count++"
        ),
        h(
          "p",
          {
            key: "动态节点",
          },
          "动态节点: " + count.value,
          [1]
        ),
        hBlock("div", { key: "子block节点" }, [
          h(
            "p",
            {
              key: "子block节点的动态节点",
            },
            "子block节点的动态节点: " + count.value,
            [1]
          ),
        ]),
      ]);
    }
    effect(
      () => {
        const vnode = comRender();
        console.log("vnode", vnode);
        renderer.render(vnode, document.getElementById("app1"));
      },
      {
        scheduler(fn) {
          jobQueue.add(fn);
          flushJob();
        },
      }
    );
  }
})();
