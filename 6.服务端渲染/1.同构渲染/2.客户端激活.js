// 这里的设定 childre只是是string 或者节点数组(节点数组里面不能带有文本) 节点可以有文本节点 元素节点 注释节点 fragment节点(children为节点数组)等
// 文本节点和元素节点的children都是字符串

(() => {
  const {
    effect,
    reactive,
    ref,
    shallowReactive,
    shallowReadonly,
    shallowRef,
  } = VueReactivity;

  const Text = Symbol();
  const Comment = Symbol();
  const Fragment = Symbol();

  // 创建缓存调度器
  function createTickScheduler() {
    const queue = new Set();
    const p = Promise.resolve();
    let isFlushing = false;

    return (job) => {
      queue.add(job);
      // nextTick刷新
      if (isFlushing === true) return;
      isFlushing = true;
      p.then(() => {
        queue.forEach((job) => job());
      }).finally(() => {
        isFlushing = false;
        queue.clear();
      });
    };
  }

  // 当前实例
  let currComponentIns = null;
  // 设置当前组件实例
  function setCurrComponentIns(componentIns) {
    currComponentIns = componentIns;
  }
  // onMounted方法
  function onMounted(fn) {
    if (currComponentIns) {
      currComponentIns.mounted.push(fn);
    } else {
      console.error("onMounted 函数只能在 setup 中调用");
    }
  }
  // onUnMounted方法
  function onUnMounted(fn) {
    if (currComponentIns) {
      currComponentIns.unMounted.push(fn);
    } else {
      console.error("onMounted 函数只能在 setup 中调用");
    }
  }

  // 定义异步组件(高阶组件)
  function defineAsyncComponent(options) {
    // 如果是函数则是一个loader 包装成options的格式
    if (typeof options === "function") {
      options = {
        loader: options,
      };
    }
    const {
      loader,
      timeout,
      errorComponent,
      delay,
      loadingComponent,
      onError,
    } = options;

    // 存储真实组件
    let innerCom = null;

    // 记录重试次数
    let retries = 0;
    function load() {
      // 拦截报错 返回promise将控制权传递给onError回调
      return loader().catch((err) => {
        if (onError) {
          return new Promise((resolve, reject) => {
            // 重试函数
            const retry = () => {
              resolve(load());
              retries++;
            };
            // 失败函数
            const fail = () => {
              reject(err);
            };
            onError(retry, fail, retries);
          });
        } else {
          throw err;
        }
      });
    }

    // 返回包装组件
    return {
      name: "AsyncComponentWrapper",
      setup(props, { attrs, emit, slots }) {
        // 是否异步加载组件成功
        const isLoad = ref(false);
        // 错误对象
        const error = shallowRef(null);
        // 是否加载中
        const isLoading = ref(false);

        // 如果没有loading延迟则设置为true 否则延迟后才设置
        let loadingIndex = null;
        if (!delay) {
          isLoading.value = true;
        } else {
          loadingIndex = setTimeout(() => {
            isLoading.value = true;
          }, delay);
        }

        // 获取异步组件
        load()
          .then((com) => {
            innerCom = com;
            isLoad.value = true;
          })
          .catch((err) => {
            error.value = err;
          })
          .finally(() => {
            isLoading.value = false;
            // 执行完清空定时器
            clearTimeout(timeIndex);
            clearTimeout(loadingIndex);
          });

        // 如果定义超时字段 则判断超时 并作为超时错误处理
        let timeIndex = null;
        if (timeout) {
          timeIndex = setTimeout(() => {
            error.value = new Error(
              `Async component timed out after ${timeout}ms.`
            );
          }, timeout);
        }
        // 包装组件卸载时候清空定时器
        onUnMounted(() => {
          clearTimeout(timeIndex);
          clearTimeout(loadingIndex);
        });

        // 返回渲染函数
        // 异步组件加载完则返回异步组件 否则返回一个注释节点占位 这里为了方便采用Text节点
        const placeholder = {
          type: Text,
          key: "占位节点",
          children: "",
        };
        return function () {
          if (error.value && errorComponent) {
            // 发生错误且错误组件存在
            return {
              type: errorComponent,
              key: "错误组件",
              props: { error: error.value },
              children: "",
            };
          } else if (isLoading.value && loadingComponent) {
            // 加载中且加载组件存在
            return {
              type: loadingComponent,
              key: "加载组件",
            };
          } else if (isLoad.value) {
            // 没错误 且加载完 返回真实组件
            return {
              type: innerCom,
              key: "真实组件",
              props: { ...props, ...attrs },
              children: slots,
            };
          } else {
            return placeholder;
          }
        };
      },
    };
  }

  // keep-alive组件
  const KeepAlive = {
    __isKeepAlive: true, // keepAlive组件特有的标识
    setup(props, { slots }) {
      // 创建缓存对象{vnode.type: vnode}
      const cache = new Map();
      // 当前keepAlive的实例
      const componentIns = currComponentIns;
      // keepAlive的实例存在特殊的keepAliveCtx对象
      const { move, createElement } = componentIns.keepAliveCtx;
      // 创建隐藏容器
      const storageContainer = createElement("div");
      // 给实例增加 激活 和失活两个方法
      // 失活 将节点先放在隐藏容器中
      componentIns._deActivate = (vnode) => {
        move(vnode, storageContainer);
      };
      // 激活 将节点从隐藏容器 移动回当前容器
      componentIns._activate = (vnode, container, anchor) => {
        move(vnode, container, anchor);
      };

      return () => {
        // 获取keepAlive的组件
        const rawVNode = slots.default();
        // 不是组件节点则直接渲染
        if (typeof rawVNode.type !== "object") {
          return rawVNode;
        }

        // 获取缓存节点
        const cacheVNode = cache.get(rawVNode.type);
        // 存在缓存节点则标记keptAlive为true 在挂载时候判断有这个属性则不需要挂载 直接激活就行
        if (cacheVNode) {
          // 继承之前的component
          rawVNode.component = cacheVNode.component;
          rawVNode.keptAlive = true;
        } else {
          cache.set(rawVNode.type, rawVNode);
        }

        // 标记组件shouldKeepAlive属性 避免被卸载
        rawVNode.shouldKeepAlive = true;
        // 将keepAlive的实例也挂载到vnode上 以便在渲染器中访问
        rawVNode.keepAliveComponentIns = componentIns;

        return rawVNode;
      };
    },
  };

  // Teleport组件
  const Teleport = {
    __isTeleport: true,
    process(oldNode, newNode, container, anchor, internals) {
      const { patch, _patchChildren, move } = internals;
      if (!oldNode) {
        // 旧节点不存在 直接挂载
        // 获取挂载点
        const target =
          typeof newNode.props.to === "string"
            ? document.querySelector(newNode.props.to)
            : newNode.props.to;
        newNode.children.forEach((c) => patch(null, c, target));
      } else {
        // 先更新节点
        _patchChildren(oldNode, newNode, container);
        // 新旧to不同则需要移动
        if (oldNode.props.to !== newNode.props.to) {
          // 新容器
          const newTarget =
            newNode.props.to === "string"
              ? document.querySelector(newNode.props.to)
              : newNode.props.to;
          // 移动节点
          newNode.children.forEach((c) => move(c, newTarget));
        }
      }
    },
  };

  // Transition组件
  const Transition = {
    name: "Transition",
    setup(props, { slots }) {
      return () => {
        const insertNode = slots.default();
        // 增加transition属性
        insertNode.transition = {
          beforeEnter(el) {
            el.classList.add("enter-from");
            el.classList.add("enter-active");
          },
          enter(el) {
            requestAnimationFrame(() => {
              el.classList.remove("enter-from");
              el.classList.add("enter-to");
              el.addEventListener("transitionend", () => {
                el.classList.remove("enter-to");
                el.classList.remove("enter-active");
              });
            });
          },
          leave(el, performRemove) {
            // beforeLeave
            el.classList.add("leave-from");
            el.classList.add("leave-active");

            // leave阶段
            requestAnimationFrame(() => {
              el.classList.remove("leave-from");
              el.classList.add("leave-to");
              el.addEventListener("transitionend", () => {
                el.classList.remove("leave-to");
                el.classList.remove("leave-active");
                performRemove();
              });
            });
          },
        };
        return insertNode;
      };
    },
  };

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
        vnode.children.forEach((vnode) => _unmountNode(vnode));
      } else if (
        typeof vnode.type === "object" ||
        typeof vnode.type === "function"
      ) {
        if (vnode.shouldKeepAlive) {
          // keepAlive组件只需要失活 不需要卸载
          vnode.keepAliveComponentIns._deActivate(vnode);
        } else {
          // 组件卸载只需要subtree
          _unmountNode(vnode.component.subTree);
          // 调用卸载事件
          vnode.component.unMounted &&
            vnode.component.unMounted.forEach((fn) => fn());
        }
      } else {
        const parent = vnode.el.parentNode;
        if (parent) {
          const performRemove = () => parent.removeChild(vnode.el);
          // 过渡元素
          if (vnode.transition) {
            vnode.transition.leave(vnode.el, performRemove);
          } else {
            performRemove();
          }
        }
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

      // 过渡前
      if (vnode.transition) {
        vnode.transition.beforeEnter(el);
      }

      // 插入容器
      insertElement(el, container, anchor);

      // 开始过渡
      if (vnode.transition) {
        vnode.transition.enter(el);
      }
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
        // 注意: 如果更新数量不足 也需要移动 这里原书没有
        if (updateCount < count) moved = true;

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

    // 解析props
    function __resolveProps(propsOptions, vnodeProps) {
      const props = {};
      const attrs = {};
      // 这里省略了props的各种校验
      // 如果组件props选项定义过 或者以on开头的则是真正的props 否则按照attrs处理
      for (let key in vnodeProps) {
        if ((propsOptions && key in propsOptions) || key.startsWith("on")) {
          props[key] = vnodeProps[key];
        } else {
          attrs[key] = vnodeProps[key];
        }
      }
      return [props, attrs];
    }

    // 挂载组件
    function _mountComponent(vnode, container, anchor) {
      // 组件选项
      let componentOptions = vnode.type;
      // 是否函数组件
      const isFunctionalComponent = typeof vnode.type === "function";
      // 组件函数转换成选项格式
      if (isFunctionalComponent) {
        componentOptions = {
          render: vnode.type,
          props: vnode.type.props,
        };
      }

      // 获取组件选项
      let {
        render,
        data,
        beforeCreated,
        created,
        beforeMount,
        mounted,
        beforeUpdate,
        updated,
        props: propsOptions,
        methods,
        setup,
      } = componentOptions;

      // beforeCreated事件
      beforeCreated && beforeCreated();

      // 将data数据进行响应化
      const state = data ? reactive(data()) : null;
      // 获取props和attrs
      const [props, attrs] = __resolveProps(propsOptions, vnode.props);
      // slots直接采用children
      const slots = vnode.children || {};

      // 定义组件实例并挂载在vnode上
      const componentIns = {
        state,
        props: shallowReactive(props), // props响应化 只要属性值发生改变就会触发组件更新
        attrs: shallowReactive(attrs), // attrs浅响应 只要属性值发生改变就会触发组件更新
        methods,
        slots, // 不同于props是修改值导致组件重新触发 slots是直接在render函数中执行 因此父元素的state会直接收集组件的更新 只要父元素state值发生改变就自动触发组件更新
        isMounted: false,
        mounted: [], // 存储onMounted的数组
        unMounted: [], // 存储unMounted的数组
        subTree: null,
        keepAliveCtx: null, // keepAlive组件实例才有这个属性
      };
      // keepAlive组件才挂载
      const isKeepAlive = vnode.type.__isKeepAlive;
      if (isKeepAlive) {
        componentIns.keepAliveCtx = {
          createElement,
          move(vnode, container, anchor) {
            insertElement(vnode.component.subTree.el, container, anchor);
          },
        };
      }

      vnode.component = componentIns;

      // setup返回的state 地位等同于data()
      let setupState = null;
      // 如果setup函数存在才执行
      if (setup) {
        // emit实现
        function emit(event, ...payload) {
          // 获取事件名称
          const eventName = `on${event[0].toUpperCase() + event.slice(1)}`;
          // 在props中查找到事件并执行 不存在则报错提示
          const handle = componentIns.props[eventName];
          if (handle) {
            handle(...payload);
          } else {
            console.error(`事件${handle}不存在`);
          }
        }
        // setup上下文
        const setupContext = {
          attrs: componentIns.attrs,
          emit,
          slots: componentIns.slots,
        };
        // 设置当前组件实例
        setCurrComponentIns(componentIns);
        // 返回函数则作为render函数处理 否则作为setupState处理
        const setupRet = setup(
          shallowReadonly(componentIns.props),
          setupContext
        );
        // 清空当前组件实例
        setCurrComponentIns(null);
        if (typeof setupRet === "function") {
          // 如果还存在render函数则给个错误提示
          if (render)
            console.error("setup 函数返回渲染函数，render 选项将被忽略");
          render = setupRet;
        } else {
          setupState = setupRet;
        }
      }

      // 不单单能通过this访问state还要能访问props等 因此需要搞个上下文对象代理访问state props computed methods啥的
      const renderContext = new Proxy(componentIns, {
        get(target, key, p) {
          const { state, props, methods, slots } = target;
          // 如果是$slots代理到
          if (key === "$slots") return slots;

          // 先从state中查找 没有再从props中查找
          if (state && key in state) {
            return state[key];
          } else if (props && key in props) {
            return props[key];
          } else if (methods && key in methods) {
            // 注意: methods书中没有 自己实现
            return methods[key].bind(renderContext);
          } else if (setupState && key in setupState) {
            return setupState[key];
          } else {
            console.error(`获取${key}不存在`);
          }
        },
        set(target, key, value, p) {
          const { state, props } = target;
          // 先从state查找存在则设置 否则从props查找存在则报错 最后直接报错
          // 注意: 这里没有对methods进行处理 不知道vue3内部是否也是这么实现
          if (state && key in state) {
            state[key] = value;
          } else if (props && key in props) {
            console.warn(
              `Attempting to mutate prop "${key}". Props are readonly.`
            );
          } else if (methods && key in methods) {
            methods[key] = value;
          } else if (setupState && key in setupState) {
            setupState[key] = value;
          } else {
            console.error(`设置${key}不存在`);
          }
        },
      });

      // created事件
      created && created.call(renderContext);

      // 包裹effect实现组件自更新
      // 因为会重复触发 因此需要判断是挂载还是更新
      const scheduler = createTickScheduler();
      componentIns.update = effect(
        () => {
          // 获取虚拟DOM
          const subTree = render.call(renderContext, renderContext);
          // 注意: 设置根dom属性为attrs(自己实现)
          subTree.props = subTree.props
            ? { ...subTree.props, ...componentIns.attrs }
            : { ...componentIns.attrs };

          // 没挂载则挂载 否则更新
          if (componentIns.isMounted === false) {
            // beforeMount 事件
            beforeMount && beforeMount.call(renderContext);
            // 如果存在el说明是客户端激活
            if (vnode.el) {
              _hydrateNode(vnode.el, subTree);
            } else {
              // 挂载虚拟节点
              patch(null, subTree, container, anchor);
            }
            // 挂载完成后设置isMounted=true
            componentIns.isMounted = true;
            // mounted 事件
            mounted && mounted.call(renderContext);
            componentIns.mounted &&
              componentIns.mounted.forEach((fn) => fn.call(renderContext));
          } else {
            // beforeUpdate 事件
            beforeUpdate && beforeUpdate.call(renderContext);
            // 更新
            patch(componentIns.subTree, subTree, container);
            // updated 事件
            updated && updated.call(renderContext);
          }
          // 挂载更新完设置子树
          componentIns.subTree = subTree;
        },
        {
          scheduler,
        }
      );
    }

    // 组件属性是否有变化
    function __hasComponentPropsChange(oldProps, newProps) {
      // 数量不相同则返回true
      if (Object.keys(oldProps).length !== Object.keys(newProps)) return true;
      // 遍历新属性 有一个和就属性不相同则返回true
      for (let key in newProps) {
        if (newProps[key] !== oldProps[key]) return true;
      }
      // 否则返回false
      return false;
    }

    // 更新组件
    function _patchComponent(oldNode, newNode) {
      // 将旧节点的component属性赋值给新节点
      const componentIns = (newNode.component = oldNode.component);

      // 更新props和attrs
      // 盲猜不直接覆盖是因为要保留props和attrs的浅响应能力 如果vnode的props改变才更新
      const { props: oldProps, attrs: oldAttrs } = componentIns;
      if (__hasComponentPropsChange(oldNode.props, newNode.props)) {
        const [newProps, newAttrs] = __resolveProps(
          newNode.type.props,
          newNode.props
        );
        // 遍历新props更新内容 遍历老的props删除不在新值的属性
        for (let key in newProps) {
          oldProps[key] = newProps[key];
        }
        for (let key in oldProps) {
          if (!key in newProps) {
            delete oldProps[key];
          }
        }
        // 更新attrs
        for (let key in newAttrs) {
          oldAttrs[key] = newAttrs[key];
        }
        for (let key in oldAttrs) {
          if (!key in newAttrs) {
            delete oldAttrs[key];
          }
        }
      }

      // 更新slots
      // 自己实现 这里感觉只需要将children直接赋值就行了
      componentIns.slots = newNode.children || {};
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
      } else if (typeof type === "object" && type.__isTeleport) {
        // teleport组件
        // 调用组件的process方法将控制权传递出去 最后一个参数是渲染器的一些内部方法
        type.process(oldNode, newNode, container, anchor, {
          patch,
          _patchChildren,
          _unmountNode,
          move(vnode, container, anchor) {
            insertElement(
              vnode.component ? vnode.component.subTree.el : vnode.el,
              container,
              anchor
            );
          },
        });
      } else if (typeof type === "object" || typeof type === "function") {
        // 组件类型的挂载
        if (!oldNode) {
          if (newNode.keptAlive) {
            // 如果组件已经keepAlive 只需要激活
            newNode.keepAliveComponentIns._activate(newNode, container, anchor);
          } else {
            // 挂载组件
            _mountComponent(newNode, container, anchor);
          }
        } else {
          // 更新组件
          _patchComponent(oldNode, newNode, container);
        }
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

    // 将vnode渲染成html
    const renderVnodeToHtml = () => {
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
        const { type: tag, props, children } = vnode;
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
      function renderComponentVnode(vnode, container, anchor) {
        // 组件选项
        let componentOptions = vnode.type;
        // 是否函数组件
        const isFunctionalComponent = typeof vnode.type === "function";
        // 组件函数转换成选项格式
        if (isFunctionalComponent) {
          componentOptions = {
            render: vnode.type,
            props: vnode.type.props,
          };
        }

        // 获取组件选项
        let {
          render,
          data,
          beforeCreated,
          created,
          beforeMount,
          mounted,
          beforeUpdate,
          updated,
          props: propsOptions,
          methods,
          setup,
        } = componentOptions;

        // beforeCreated事件
        beforeCreated && beforeCreated();

        // data数据无需响应式
        const state = data ? data() : null;
        // 获取props和attrs
        const [props, attrs] = __resolveProps(propsOptions, vnode.props);
        // slots直接采用children
        const slots = vnode.children || {};

        // 定义组件实例并挂载在vnode上
        const componentIns = {
          state,
          props: props, // 无需浅响应
          attrs: attrs, // 无需浅响应
          methods,
          slots, // 不同于props是修改值导致组件重新触发 slots是直接在render函数中执行 因此父元素的state会直接收集组件的更新 只要父元素state值发生改变就自动触发组件更新
        };

        vnode.component = componentIns;

        // setup返回的state 地位等同于data()
        let setupState = null;
        // 如果setup函数存在才执行
        if (setup) {
          // emit实现
          function emit(event, ...payload) {
            // 获取事件名称
            const eventName = `on${event[0].toUpperCase() + event.slice(1)}`;
            // 在props中查找到事件并执行 不存在则报错提示
            const handle = componentIns.props[eventName];
            if (handle) {
              handle(...payload);
            } else {
              console.error(`事件${handle}不存在`);
            }
          }
          // setup上下文
          const setupContext = {
            attrs: componentIns.attrs,
            emit,
            slots: componentIns.slots,
          };
          // 设置当前组件实例
          setCurrComponentIns(componentIns);
          // 返回函数则作为render函数处理 否则作为setupState处理
          const setupRet = setup(
            shallowReadonly(componentIns.props),
            setupContext
          );
          // 清空当前组件实例
          setCurrComponentIns(null);
          if (typeof setupRet === "function") {
            // 如果还存在render函数则给个错误提示
            if (render)
              console.error("setup 函数返回渲染函数，render 选项将被忽略");
            render = setupRet;
          } else {
            setupState = setupRet;
          }
        }

        // 不单单能通过this访问state还要能访问props等 因此需要搞个上下文对象代理访问state props computed methods啥的
        const renderContext = new Proxy(componentIns, {
          get(target, key, p) {
            const { state, props, methods, slots } = target;
            // 如果是$slots代理到
            if (key === "$slots") return slots;

            // 先从state中查找 没有再从props中查找
            if (state && key in state) {
              return state[key];
            } else if (props && key in props) {
              return props[key];
            } else if (methods && key in methods) {
              // 注意: methods书中没有 自己实现
              return methods[key].bind(renderContext);
            } else if (setupState && key in setupState) {
              return setupState[key];
            } else {
              console.error(`获取${key}不存在`);
            }
          },
          set(target, key, value, p) {
            const { state, props } = target;
            // 先从state查找存在则设置 否则从props查找存在则报错 最后直接报错
            // 注意: 这里没有对methods进行处理 不知道vue3内部是否也是这么实现
            if (state && key in state) {
              state[key] = value;
            } else if (props && key in props) {
              console.warn(
                `Attempting to mutate prop "${key}". Props are readonly.`
              );
            } else if (methods && key in methods) {
              methods[key] = value;
            } else if (setupState && key in setupState) {
              setupState[key] = value;
            } else {
              console.error(`设置${key}不存在`);
            }
          },
        });

        // created事件
        created && created.call(renderContext);

        // 无需effect 只选渲染就行
        const subTree = render.call(renderContext, renderContext);
        return renderVNode(subTree);
      }

      // 渲染节点
      function renderVNode(vnode) {
        const tag = vnode.type;
        if (typeof tag === "string") {
          return renderElementVnode(vnode);
        } else if (typeof tag === "object") {
          return renderComponentVnode(vnode);
        } else {
          // 其他类型 text fragment啥的
        }
      }

      return { renderVNode };
    };

    // -------------- 客户端激活相关函数 -----------------
    // 激活函数
    function hydrate(vnode, container) {
      // 从容器的第一个元素开始
      _hydrateNode(container.firstChild, vnode);
    }

    // 激活节点
    function _hydrateNode(el, vnode) {
      // 虚拟节点引用真实dom
      vnode.el = el;

      if (typeof vnode.type === "object") {
        _mountComponent(vnode, el);
      } else if (typeof vnode.type === "string") {
        // 检查类型是否匹配
        if (el.nodeType !== 1) {
          console.error("mismatch");
          console.error("服务端渲染的真实 DOM 节点是：", el);
          console.error("客户端渲染的虚拟 DOM 节点是：", vnode);
        } else {
          _hydrateElementNode(el, vnode);
        }
      }

      // 返回下一个节点
      return el.nextSibling;
    }

    // 激活元素节点
    function _hydrateElementNode(el, vnode) {
      // 为dom添加事件
      if (vnode.props) {
        for (let key in vnode.props) {
          if (/^on/.test(key)) {
            patchProps(el, key, null, vnode.props[key]);
          }
        }
      }
      // 递归激活子节点
      if (Array.isArray(vnode.children)) {
        // 第一个节点开始
        let nextNode = el.firstChild;
        for (let i = 0; i < vnode.children.length; i++) {
          nextNode = _hydrateNode(nextNode, vnode.children[i]);
        }
      }
    }

    return {
      render,
      renderVnodeToHtml,
      hydrate,
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

    const scheduler = createTickScheduler();

    // 虚拟DOM-元素
    const elementVnode = {
      type: "span",
      props: {
        key: "文本节点",
        ref: "span",
        class: "<m-text>",
        checked: true,
        onClick: () => alert("hello"),
      },
      children: [
        {
          type: "span",
          children: "<click> ",
        },
        {
          type: "img",
          props: {
            width: "50",
            src: "https://pica.zhimg.com/v2-baf7191e78a25d807b09e1bc01f72817_l.jpg?source=32738c0c",
          },
        },
        {
          type: "span",
          children: "me",
        },
      ],
    };
    // 虚拟DOM-组件
    const MyComponent = {
      props: {
        title: String,
      },
      data() {
        return {
          count: 1,
        };
      },
      setup(props, setupContext) {
        return function () {
          return {
            type: "div",
            children: [
              {
                type: "p",
                props: {
                  onClick: (() => {
                    this.count++;
                  }).bind(this),
                },
                children: "组件,点击+1: " + props.title + ": " + this.count,
              },
              elementVnode,
            ],
          };
        };
      },
    };
    effect(
      () => {
        const componentVnode = {
          type: MyComponent,
          props: {
            title: "温叶",
          },
        };
        renderer.render(componentVnode, document.querySelector("#app1"));

        // 将虚拟DOM渲染成html
        const html = renderer.renderVnodeToHtml().renderVNode(componentVnode);
        document.querySelector("#app2").innerHTML = html;
        console.log(html);

        // 激活客户端
        renderer.hydrate(componentVnode, document.querySelector("#app2"));
      },
      {
        scheduler,
      }
    );
  }
})();
