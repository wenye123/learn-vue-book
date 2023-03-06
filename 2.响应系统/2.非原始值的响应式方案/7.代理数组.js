(() => {
  let activeEffect; // 存储被注册的副作用函数
  const effectStack = []; // effect栈
  // 注册副作用函数
  function effect(fn, options = {}) {
    // 将副作用函数包装一层
    const effectFn = () => {
      // 执行函数前清除之前的依赖集合
      cleanup(effectFn);
      activeEffect = effectFn;
      effectStack.push(activeEffect); // 执行副作用函数之前压入栈
      const res = fn(); // 执行副作用函数会重新收集依赖
      // 执行完后弹出栈 并重置activeEffect的值
      effectStack.pop();
      activeEffect = effectStack[effectStack.length - 1];
      return res;
    };
    // 存储选项
    effectFn.options = options;
    // 副作用函数存储对应的依赖集合
    effectFn.deps = [];
    // 不是懒加载模式才执行
    if (!options.lazy) {
      effectFn();
    }
    return effectFn;
  }
  // 清除依赖集合函数
  function cleanup(effectFn) {
    // 将依赖集合删除副作用函数
    for (let deps of effectFn.deps) {
      deps.delete(effectFn);
    }
    // 重置副作用函数依赖集合长度
    effectFn.deps.length = 0;
  }

  // 使用weakMap是为了不计入垃圾回收引入
  const bucket = new WeakMap();
  const INTERATE_KEY = Symbol(); // 唯一key
  const TriggerType = {
    SET: "SET",
    ADD: "ADD",
    DELETE: "DELETE",
  };
  // 重新数组方法
  const arrayIns = {};
  ["includes", "find", "findIndex", "indexOf", "lastIndexOf", "filter"].forEach(
    (method) => {
      const originMethod = Array.prototype[method];
      arrayIns[method] = function (...args) {
        // 先在代理对象中查找 this就是代理对象
        let res = originMethod.apply(this, args);
        // 找不到再从原始对象中查找 this._raw就是原始对象
        if (
          res === false ||
          res === undefined ||
          res === -1 ||
          (Array.isArray(res) && res.length == 0)
        ) {
          res = originMethod.apply(this._raw, args);
        }
        // 返回结果
        return res;
      };
    }
  );
  // 是否依赖收集依赖
  let shouldTrack = true;
  [
    "push",
    "pop",
    "shift",
    "unshift",
    "splice",
    "sort",
    "reverse",
    "fill",
  ].forEach((method) => {
    const originMethod = Array.prototype[method];
    arrayIns[method] = function (...args) {
      // 调用方法之前禁用
      shouldTrack = false;
      const res = originMethod.apply(this, args);
      // 调用方法后恢复
      shouldTrack = true;
      return res;
    };
  });
  function createReactive(source, isShallow = false, isReadonly = false) {
    return new Proxy(source, {
      get(source, key, p) {
        // 给p增加_raw字段返回sourse
        if (key === "_raw") return source;
        // 访问数组且key在arrayIns上 直接返回arrayIns上的方法
        if (Array.isArray(source) && arrayIns.hasOwnProperty(key)) {
          return Reflect.get(arrayIns, key, p);
        }

        const res = Reflect.get(source, key, p);
        // 非只读才收集依赖
        if (isReadonly === false && typeof key !== "symbol") {
          track(source, key);
        }
        // 浅响应
        if (isShallow === true) return res;
        // 深响应 对象则递归
        if (typeof res === "object" && res !== null) {
          return isReadonly ? readonly(res) : reactive(res);
        } else {
          return res;
        }
      },
      // has判断 key in obj
      has(source, key) {
        // 非只读才收集依赖
        if (isReadonly === false && typeof key !== "symbol") {
          track(source, key);
        }
        return Reflect.has(source, key);
      },
      // ownKeys判断for in
      ownKeys(source) {
        // 非只读才收集依赖
        if (isReadonly === false && typeof key !== "symbol") {
          // 数组直接通过length属性收集依赖
          track(source, Array.isArray(source) ? "length" : INTERATE_KEY);
        }
        return Reflect.ownKeys(source);
      },

      set(source, key, newVal, p) {
        // 只读模式 打印警告信息并返回
        if (isReadonly === true) {
          console.warn(`属性${key}是只读的`);
          return true;
        }
        // 获取旧值
        const oldVal = source[key];
        // 判断是新增还是更新
        const type = Array.isArray(source)
          ? Number(key) < source.length
            ? TriggerType.SET
            : TriggerType.ADD
          : Object.prototype.hasOwnProperty.call(source, key)
          ? TriggerType.SET
          : TriggerType.ADD;
        const res = Reflect.set(source, key, newVal, p);
        // 直接访问的代理对象才触发
        if (p._raw === source) {
          // 新旧值不相等才触发 并且有一个不是NaN
          if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
            trigger(source, key, type, newVal); // 传递第四个参数
          }
        }
        return res;
      },
      deleteProperty(source, key) {
        // 只读模式 打印警告信息并返回
        if (isReadonly === true) {
          console.warn(`属性${key}是只读的`);
          return true;
        }
        const hasKey = Object.prototype.hasOwnProperty.call(source, key);
        const res = Reflect.deleteProperty(source, key);
        // 只有当删除成功且是自身属性才触发
        if (res && hasKey) {
          trigger(source, key, TriggerType.DELETE);
        }
        return res;
      },
    });
  }
  function shallowReactive(source) {
    return createReactive(source, true, false);
  }
  const reactiveMap = new Map();
  function reactive(source) {
    // 存在则直接返回
    const existProxy = reactiveMap.get(source);
    if (existProxy) return existProxy;
    // 不存在才重新创建
    const proxy = createReactive(source, false, false);
    reactiveMap.set(source, proxy);
    return proxy;
  }
  function shallowReadonly(source) {
    return createReactive(source, true, true);
  }
  const readonlyMap = new Map();
  function readonly(source) {
    // 存在则直接返回
    const existProxy = readonlyMap.get(source);
    if (existProxy) return existProxy;
    // 不存在才重新创建
    const proxy = createReactive(source, false, true);
    readonlyMap.set(source, proxy);
    return proxy;
  }
  function track(source, key) {
    // effect不存在且不应该收集 则返回
    if (!activeEffect || !shouldTrack) return;
    // 获取对象map
    let depsMap = bucket.get(source);
    if (!depsMap) bucket.set(source, (depsMap = new Map()));
    // 获取对象key map，值为set
    let deps = depsMap.get(key);
    if (!deps) depsMap.set(key, (deps = new Set()));
    deps.add(activeEffect);
    // 副作用函数添加依赖集合
    activeEffect.deps.push(deps);
  }
  function trigger(source, key, type, newVal) {
    const depsMap = bucket.get(source);
    if (!depsMap) return;
    const deps = depsMap.get(key);

    const runDeps = new Set();
    deps &&
      deps.forEach((fn) => {
        if (fn !== activeEffect) {
          runDeps.add(fn);
        }
      });

    // 添加INTERATE_KEY的依赖 只有新增和删除才触发
    if (type === TriggerType.ADD || type === TriggerType.DELETE) {
      const interateDeps = depsMap.get(INTERATE_KEY); // 获取INTERATE_KEY的依赖
      interateDeps &&
        interateDeps.forEach((fn) => {
          if (fn !== activeEffect) {
            runDeps.add(fn);
          }
        });
    }

    // 数组add时候 执行length的依赖
    if (Array.isArray(source) && type === TriggerType.ADD) {
      const lengthDeps = depsMap.get("length");
      lengthDeps &&
        lengthDeps.forEach((fn) => {
          if (fn !== activeEffect) {
            runDeps.add(fn);
          }
        });
    }

    // 设置数组length 需要触发>=length的元素
    // 这里有个细节 delete arr.length是不会成功的 因此不会执行到这行代码
    if (Array.isArray(source) && key === "length") {
      depsMap.forEach((deps, key) => {
        if (key >= newVal) {
          deps.forEach((fn) => {
            if (fn !== activeEffect) {
              runDeps.add(fn);
            }
          });
        }
      });
    }

    runDeps.forEach((effectFn) => {
      // 如果存在调度器则使用
      if (effectFn.options.scheduler) {
        effectFn.options.scheduler(effectFn);
      } else {
        effectFn();
      }
    });
  }

  // 计算属性
  function computed(getter) {
    // value用于缓存 dirty为true表示脏需要重新计算
    let value,
      dirty = true;

    // 创建一个lazy的effect
    const effectFn = effect(getter, {
      lazy: true,
      scheduler(fn) {
        dirty = true;
        // 手动trigger
        trigger(obj, "value");
        // fn(); // 注意这里不能直接执行 不然每次getter的依赖更新都会重新执行
      },
    });

    const obj = {
      // 读取时候才执行
      get value() {
        if (dirty) {
          value = effectFn();
          dirty = false;
        }
        // 手动track
        track(obj, "value");
        return value;
      },
    };
    return obj;
  }

  /* 实例 */
  // 设置数组值导致length更新
  {
    const arr = reactive(["name"]);
    effect(() => {
      console.log("设置数组值导致length更新");
      arr.length;
    });
    arr[1] = "wenye";
  }

  // 设置legnth的值触发>=length的索引值
  {
    const arr = reactive([1, 2, 3]);
    effect(() => {
      console.log("设置legnth的值触发>=length的索引值");
      arr[1];
    });
    arr.length = 1;
    // delete arr.length; // 注意删除length属性是不会触发的 以为length不能删除
  }

  // 在数组中 for in直接通过收集length依赖就能实现响应 新增删除和直接修改length
  {
    const arr = reactive([1, 2, 3]);
    effect(() => {
      console.log(
        "在数组中 for in直接通过收集length依赖就能实现响应 新增删除和直接修改length"
      );
      for (let i in arr) {
      }
    });
    arr[3] = 4;
    arr.length = 1;
  }

  // 迭代方法访问值和length 无需再增加代码
  {
    const arr = reactive([1, 2, 3]);
    effect(() => {
      console.log("迭代方法访问值和length 无需再增加代码");
      // for (let i of arr) {
      // }
      // arr.forEach(() => {});
      arr.join("");
    });
    arr[3] = 4;
    arr.length = 1;
  }

  // 解决reactive重复访问得到新proxy的问题
  {
    const arr = reactive([{}]);
    console.log("解决reactive重复访问得到新proxy的问题", arr[0] === arr[0]);
  }

  // 查找原始元素
  {
    const obj = {};
    const arr = reactive([obj]);
    console.log("查找原始元素", arr.includes(obj));
    console.log(
      "查找原始元素",
      arr.findIndex((item) => item === obj)
    );
    console.log(
      "查找原始元素",
      arr.find((item) => item === obj)
    );
    console.log("查找原始元素", arr.indexOf(obj));
    console.log("查找原始元素", arr.lastIndexOf(obj));
    console.log(
      "查找原始元素",
      arr.filter((item) => item === obj)
    );
  }

  // 修改的数组原型方法-内部会读取length导致所在的副作用函数被收集
  {
    const arr = reactive([1, 2, 3]);
    // 不会收集依赖导致栈溢出
    // effect(() => {
    //   arr.push(1);
    // });
    // effect(() => {
    //   arr.push(1);
    // });

    effect(() => {
      console.log("删除");
      arr[0];
    });
    arr.splice(0, 1);
  }
})();
