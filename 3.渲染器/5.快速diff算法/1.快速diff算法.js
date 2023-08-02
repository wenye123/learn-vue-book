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

    // 自己实现: 获取最长递增子序列的索引
    function _getLISIndex(nums) {
      // 边界判断
      if (nums.length === 0) return 0;
      // 转移状态和初始条件
      const dp = new Array(nums.length).fill(1); // 存储索引对应最长递增子序列的长度
      const arr = new Array(nums.length).fill([]); // 存储索引对应最长递增子序列的索引数组
      let maxDpIndex = 0; // 最大值的索引
      // 遍历
      for (let i = 0; i < nums.length; i++) {
        arr[i] = nums[i] === -1 ? [] : [i]; // 初始化数组的值去掉-1
        for (let j = 0; j < i; j++) {
          // 这里需要过滤掉-1
          if (nums[i] > nums[j] && nums[j] !== -1) {
            if (dp[j] + 1 > dp[i]) {
              dp[i] = dp[j] + 1;
              arr[i] = [...arr[j], i];
              if (dp[maxDpIndex] < dp[i]) {
                maxDpIndex = i;
              }
            }
          }
        }
      }
      return arr[maxDpIndex];
    }

    // 更新带key子节点(快速diff算法)
    function _patchKeyedChildren(oldNode, newNode, el) {
      const oldChildren = oldNode.children;
      const newChildren = newNode.children;

      // 更新前置元素
      // 前置索引和节点
      let startIndex = 0;
      let oldStatNode = oldChildren[startIndex];
      let newStartNode = newChildren[startIndex];
      // 更新前置元素
      // 书中没判断oldStatNode是否存在 会报错
      while (
        oldStatNode &&
        newStartNode &&
        oldStatNode.key === newStartNode.key
      ) {
        patch(oldStatNode, newStartNode, el);
        // 更新索引和节点
        startIndex++;
        oldStatNode = oldChildren[startIndex];
        newStartNode = newChildren[startIndex];
      }

      // 更新后置元素
      // 后置索引和节点
      let oldEndIndex = oldChildren.length - 1;
      let newEndIndex = newChildren.length - 1;
      let oldEndNode = oldChildren[oldEndIndex];
      let newEndNode = newChildren[newEndIndex];
      // 书中没有oldEndIndex >= startIndex && newEndIndex >= startIndex会报错
      while (
        oldEndIndex >= startIndex &&
        newEndIndex >= startIndex &&
        oldEndNode.key === newEndNode.key
      ) {
        patch(oldEndNode, newEndNode, el);
        // 更新索引和节点
        oldEndIndex--;
        newEndIndex--;
        oldEndNode = oldChildren[oldEndIndex];
        newEndNode = newChildren[newEndIndex];
      }

      // 老节点遍历完 新节点还有剩下则新增 锚点是最后一个节点
      if (startIndex > oldEndIndex && startIndex <= newEndIndex) {
        const anchorIndex = newEndIndex + 1; // 之前循环-- 这里+回来
        const anchor = newChildren[anchorIndex]
          ? newChildren[anchorIndex].el
          : null;
        // 新增
        while (startIndex <= newEndIndex) {
          patch(null, newChildren[startIndex], el, anchor);
          startIndex++;
        }
      } else if (startIndex > newEndIndex && startIndex <= oldEndIndex) {
        while (startIndex <= oldEndIndex) {
          _unmountNode(oldChildren[startIndex]);
          startIndex++;
        }
      } else {
        // 处理完前置和后置元素 且只剩新增和只剩删除的特殊情况 剩下的节点需要进行对比移动
        // 剩余新节点对应老节点索引的数组
        const count = newEndIndex - startIndex + 1;
        const oldIndexArr = new Array(count).fill(-1);

        // 构建剩下新节点key:index映射表
        const newNodeKeyIndexMap = {};
        for (let i = startIndex; i <= newEndIndex; i++) {
          newNodeKeyIndexMap[newChildren[i].key] = i;
        }
        // 遍历旧节点剩余节点 找得到则更新 顺带更新索引数组 找不到则卸载
        // 定义moved和currMaxOldIndex来判断是否应该移除
        // 定义updateCount来判断新节点更新完了 更新完则直接卸载剩余老节点(不定义也是可以的 反正找不到也会卸载)
        let moved = false;
        let currMaxOldNodeToNewNodeIndex = 0;
        let updateCount = 0;

        for (let i = startIndex; i <= oldEndIndex; i++) {
          // 还没更新完才更新
          if (updateCount <= count) {
            const oldNode = oldChildren[i];
            const newNodeIndex = newNodeKeyIndexMap[oldNode.key];
            // 找到则更新节点&索引数组
            if (newNodeIndex !== undefined) {
              patch(oldNode, newChildren[newNodeIndex], el);
              // 更新节点后数量+1
              updateCount++;
              // 注意: 这里索引需要减去开始节点索引
              oldIndexArr[newNodeIndex - startIndex] = i;
              // 记录是否需要移动
              if (newNodeIndex < currMaxOldNodeToNewNodeIndex) {
                moved = true;
              } else {
                currMaxOldNodeToNewNodeIndex = newNodeIndex;
              }
            } else {
              // 没找到则卸载
              _unmountNode(oldNode);
            }
          }
        }

        // 新节点在旧节点中不是有序的 需要移动
        if (moved) {
          // 获取最长递增子序列
          const seq = _getLISIndex(oldIndexArr);

          // 将旧节点最长递增子序列和剩下的新节点进行对比 如果相同则不移动 否则移动
          let seqEndIndex = seq.length - 1;
          let restNewNodeEndIndex = count - 1;
          for (; restNewNodeEndIndex >= 0; restNewNodeEndIndex--) {
            // 剩下新节点对应老节点索引值不存在则新增
            if (oldIndexArr[restNewNodeEndIndex] === -1) {
              // 获取需要插入的节点
              const inserIndex = restNewNodeEndIndex + startIndex;
              const inserNode = newChildren[inserIndex];
              // 获取下一个锚定DOM
              const anchor = newChildren[inserIndex + 1]
                ? newChildren[inserIndex + 1].el
                : null;
              // 插入节点
              patch(null, inserNode, el, anchor);
            } else if (restNewNodeEndIndex === seq[seqEndIndex]) {
              // 等同最长递增子序列则不需要移动 移动指针
              seqEndIndex--;
            } else {
              // 需要移动
              const moveIndex = restNewNodeEndIndex + startIndex;
              const moveNode = newChildren[moveIndex];
              // 获取下一个锚定DOM
              const anchor = newChildren[moveIndex + 1]
                ? newChildren[moveIndex + 1].el
                : null;
              // 移动节点
              insertElement(moveNode.el, el, anchor);
            }
          }
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
