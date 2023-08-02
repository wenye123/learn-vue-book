// 这里的设定 childre只是是string 或者节点数组(节点数组里面不能带有文本) 节点可以有文本节点 元素节点 注释节点 fragment节点(children为节点数组)等
// 文本节点和元素节点的children都是字符串

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

    // 更新带key子节点(双端diff算法)
    function _patchKeyedChildren(oldNode, newNode, el) {
      const oldChildren = [...oldNode.children];
      const newChildren = [...newNode.children];
      // 四个索引
      let oldStartIndex = 0;
      let oldEndIndex = oldChildren.length - 1;
      let newStartIndex = 0;
      let newEndIndex = newChildren.length - 1;
      // 四个节点
      let oldStartNode = oldChildren[oldStartIndex];
      let oldEndNode = oldChildren[oldEndIndex];
      let newStartNode = newChildren[newStartIndex];
      let newEndNode = newChildren[newEndIndex];

      // 更新&移动节点
      // 只要新旧节点 有一条没更新完就继续更新
      while (newEndIndex >= newStartIndex && oldEndIndex >= oldStartIndex) {
        if (!oldStartNode) {
          // 如果节点不存在(undefined)说明已经被处理 直接跳到下一个即可
          oldStartNode = oldChildren[++oldStartIndex];
        } else if (!oldEndNode) {
          // 注意: 书中没这句话 老节点尾巴节点也可能是undefined
          oldEndNode = oldChildren[--oldEndIndex];
        } else if (oldStartNode.key === newStartNode.key) {
          // 老开始节点 = 新开始节点
          // 都在头部 不需要移动 只需要更新下节点
          patch(oldStartNode, newStartNode, el);
          // 更新索引和节点
          oldStartNode = oldChildren[++oldStartIndex];
          newStartNode = newChildren[++newStartIndex];
        } else if (oldEndNode.key === newEndNode.key) {
          // 老结束节点  = 新结束节点
          // 都在尾部 不需要移动 只需要更新下节点
          patch(oldEndNode, newEndNode, el);
          // 更新索引和节点
          oldEndNode = oldChildren[--oldEndIndex];
          newEndNode = newChildren[--newEndIndex];
        } else if (oldStartNode.key === newEndNode.key) {
          // 老开始节点 = 新结束节点
          // 更新节点后将dom移动到当前旧节点尾结点的后面
          patch(oldStartNode, newEndNode, el);
          insertElement(oldStartNode.el, el, oldEndNode.el.nextSibling);
          // 更新索引和节点
          oldStartNode = oldChildren[++oldStartIndex];
          newEndNode = newChildren[--newEndIndex];
        } else if (oldEndNode.key === newStartNode.key) {
          // 老结束节点 = 新开始节点
          // 更新节点后 将dom移动到当前旧节点头节点的前面
          patch(oldEndNode, newStartNode, el);
          insertElement(oldEndNode.el, el, oldStartNode.el);
          // 更新索引和节点
          oldEndNode = oldChildren[--oldEndIndex];
          newStartNode = newChildren[++newStartIndex];
        } else {
          // 都找不到 则遍历老节点查找首节点
          // 注意: 书中没有vnode&& 实际在循环过程中oldChildren的值会变成undefined的 因此需要判断
          const indexInOld = oldChildren.findIndex(
            (vnode) => vnode && vnode.key === newStartNode.key
          );
          // 找得到则移动到头部 找不到则新增插入
          if (indexInOld > -1) {
            // 找到的节点
            const oldMatchNode = oldChildren[indexInOld];
            // 更新节点
            patch(oldMatchNode, newStartNode, el);
            // 插入到当前旧节点头部
            insertElement(oldMatchNode.el, el, oldStartNode.el);
            // 将当前旧节点位置设置为undefined
            oldChildren[indexInOld] = undefined;
            // 更新新节点开始索引和节点
            newStartNode = newChildren[++newStartIndex];
          } else {
            // 新增插入到头部
            patch(null, newStartNode, el, oldStartNode.el);
            // 更新索引和节点
            newStartNode = newChildren[++newStartIndex];
          }
        }
      }

      // 循环结束后 只剩下一条节点
      // 新节点还有剩余则新增
      // 老节点还有剩余则删除
      if (oldStartIndex > oldEndIndex && newStartIndex <= newEndIndex) {
        for (let i = newStartIndex; i <= newEndIndex; i++) {
          // 注意: 这句话自己写的 原书只写了oldStartNode.el不符合剩下的都是尾巴节点的情况
          const anchor = oldStartNode ? oldStartNode.el : null;
          patch(null, newChildren[i], el, anchor);
        }
      } else if (oldStartIndex <= oldEndIndex && newStartIndex > newEndIndex) {
        for (let i = oldStartIndex; i <= oldEndIndex; i++) {
          _unmountNode(oldChildren[i]);
        }
      }
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
          _patchKeyedChildren(oldNode, newNode, el);
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

    // 更新元素节点
    function _patchElementNode(oldNode, newNode) {
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

  // 例子
  {
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
    const data = reactive({
      list: [],
    });
    let count = 0;
    effect(
      () => {
        const vnode = {
          type: "div",
          children: [
            {
              type: "p",
              key: "add",
              props: {
                onClick() {
                  data.list.push("item" + count++);
                },
              },
              children: "增加: " + data.list.length,
            },
            {
              type: "p",
              key: "reduce",
              props: {
                onClick() {
                  if (data.list.length > 0) {
                    data.list.length = data.list.length - 1;
                  }
                },
              },
              children: "减少: " + data.list.length,
            },
            {
              type: "p",
              key: "shuffle",
              props: {
                onClick() {
                  data.list = data.list.sort((v) => Math.random() - 0.5);
                },
              },
              children: "打乱: " + data.list.length,
            },
            {
              type: "ul",
              key: "ul",
              children: data.list.map((v, i) => {
                return {
                  type: "li",
                  key: v,
                  props: {
                    onClick() {
                      data.list.splice(i, 1);
                    },
                  },
                  children: v,
                };
              }),
            },
          ],
        };
        renderer.render(vnode, document.getElementById("app1"));
      },
      {
        scheduler(fn) {
          jobQueue.add(fn);
          flushJob();
        },
      }
    );
    // 测试复杂情况
    const map = {};
    const flag = ref(true);
    for (let i = 1; i <= 7; i++) {
      map[i] = { type: "p", key: `p${i}`, children: `p${i}` };
    }
    const vnodes1 = [map[1], map[2], map[3], map[4], map[6], map[5]];
    const vnodes2 = [map[1], map[3], map[4], map[2], map[7], map[5]];
    effect(
      () => {
        const vnode = {
          type: "div",
          key: "fragment",
          props: {
            onClick() {
              flag.value = !flag.value;
            },
          },
          children: flag.value ? vnodes1 : vnodes2,
        };
        renderer.render(vnode, document.getElementById("app2"));
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
