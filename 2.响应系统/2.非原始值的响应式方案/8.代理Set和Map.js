window.Vue = ((exports) => {
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
  const INTERATE_KEY = Symbol(); // 迭代key
  const RAW_KEY = Symbol(); // 返回source对象key
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
          res = originMethod.apply(this[RAW_KEY], args);
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
  // 是否set或map
  const isSet = (obj) => {
    return Object.prototype.toString.call(obj) === "[object Set]";
  };
  const isMap = (obj) => {
    return Object.prototype.toString.call(obj) === "[object Map]";
  };
  // set map的方法
  const MAP_KEY_ITERATE_KEY = Symbol();
  function iterationMethod(type = "iterator") {
    return function () {
      // 包装函数
      const wrap = (val) =>
        typeof val === "object" && val !== null ? reactive(val) : val;
      const source = this[RAW_KEY];
      const fnMap = {
        iterator: source[Symbol.iterator],
        keys: source.keys,
        values: source.values,
      };
      const iterator = fnMap[type].call(source);
      // keys中收集的是MAP_KEY_ITERATE_KEY 避免set情况更新
      if (type === "keys") {
        track(source, MAP_KEY_ITERATE_KEY);
      } else {
        track(source, INTERATE_KEY);
      }
      return {
        // 迭代器协议
        next() {
          const { value, done } = iterator.next();
          // 这里把set的值也进行包裹 其实没啥必要 毕竟set类型无法获取值并修改
          return {
            value: value
              ? Array.isArray(value)
                ? [wrap(value[0]), wrap(value[1])]
                : wrap(value)
              : value,
            done,
          };
        },
        // 可迭代协议
        [Symbol.iterator]() {
          return this;
        },
      };
    };
  }
  // 注意: 这里不考虑深浅响应 深浅只读的情况 一律按照深响应计算
  const setMapIns = {
    get(key) {
      // 获取原始对象
      const source = this[RAW_KEY];
      // 收集依赖
      track(source, key);
      // 返回值是对象则返回深响应对象
      const res = source.get(key);
      return typeof res === "object" ? reactive(res) : res;
    },
    // 自己实现: 新增和更新都会触发 同对象的 key in obj
    has(key) {
      const source = this[RAW_KEY];
      track(source, key);
      return source.has(key);
    },

    // map.set
    set(key, value) {
      // 获取原始数据 因为最后是p.add() 所以这里this就是p
      const source = this[RAW_KEY];
      // 获取值是否存在
      const hasVal = source.has(key);
      // 获取旧值
      const oldVal = source.get(key);
      // 调用原始方法 value可能是响应式数据 为了避免污染数据写入原始数据
      const res = source.set(key, value[RAW_KEY] || value);
      // 不存在触发新增 存在且值不相同并且有一个不是NaN则触发更新
      if (!hasVal) {
        trigger(source, key, TriggerType.ADD);
      } else if (oldVal !== value && (oldVal === oldVal || value === value)) {
        trigger(source, key, TriggerType.SET);
      }
      return res;
    },
    // set.add
    add(key) {
      const source = this[RAW_KEY];
      const hasVal = source.has(key);
      // 避免污染数据 写入原始数据
      const res = source.add(key[RAW_KEY] || key);
      // 不存在则触发新增(因为唯一性不存在更新情况)
      if (!hasVal) {
        trigger(source, key, TriggerType.ADD);
      }
      return res;
    },
    delete(key) {
      const source = this[RAW_KEY];
      const hasVal = source.has(key);
      const res = source.delete(key);
      // 存在才删除
      if (hasVal) {
        trigger(source, key, TriggerType.DELETE);
      }
      return res;
    },
    // 自己实现: 循环触发delete
    clear() {
      const source = this[RAW_KEY];
      const res = source.clear(key);
      // 循环触发删除
      for (let key of source.keys()) {
        trigger(source, key, TriggerType.DELETE);
      }
      return res;
    },

    // 循环
    forEach(cb, thisArg) {
      const wrap = (val) =>
        typeof val === "object" && val !== null ? reactive(val) : val;
      const source = this[RAW_KEY];
      track(source, INTERATE_KEY);
      source.forEach((val, key) => {
        cb.call(thisArg, wrap(val), wrap(key), this);
      });
    },

    // 迭代
    [Symbol.iterator]: iterationMethod("iterator"),
    entries: iterationMethod("iterator"),
    keys: iterationMethod("keys"),
    values: iterationMethod("values"),
  };
  function createReactive(source, isShallow = false, isReadonly = false) {
    return new Proxy(source, {
      get(source, key, p) {
        // 给p增加_raw字段返回sourse
        if (key === RAW_KEY) return source;
        // 访问数组且key在arrayIns上 直接返回arrayIns上的方法
        if (Array.isArray(source) && arrayIns.hasOwnProperty(key)) {
          return Reflect.get(arrayIns, key, p);
        }
        // set map需要绑定this
        if (isSet(source) || isMap(source)) {
          if (key === "size") {
            track(source, INTERATE_KEY); // 收集的是新增和删除触发的key
            return Reflect.get(source, key, source);
          } else {
            return setMapIns[key];
          }
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
        if (p[RAW_KEY] === source) {
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
    // map下是特例 更新情况也要触发
    if (
      type === TriggerType.ADD ||
      type === TriggerType.DELETE ||
      (type === TriggerType.SET && isMap(source))
    ) {
      const interateDeps = depsMap.get(INTERATE_KEY); // 获取INTERATE_KEY的依赖
      interateDeps &&
        interateDeps.forEach((fn) => {
          if (fn !== activeEffect) {
            runDeps.add(fn);
          }
        });
    }

    // map下添加或删除触发MAP_KEY_ITERATE_KEY依赖 专门针对map.keys()的情况
    if (
      (type === TriggerType.ADD || type === TriggerType.DELETE) &&
      isMap(source)
    ) {
      const interateDeps = depsMap.get(MAP_KEY_ITERATE_KEY);
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

  exports.effect = effect;
  exports.reactive = reactive;
  exports.shallowReactive = shallowReactive;
  exports.readonly = readonly;
  exports.shallowReadonly = shallowReadonly;
  exports.track = track;
  exports.trigger = trigger;
  exports.computed = computed;

  /******************************* 实例 *****************************/
  // {
  //   // set size修改
  //   {
  //     const setP = reactive(new Set([]));
  //     effect(() => {
  //       console.log("set触发");
  //       setP.size;
  //     });
  //     setP.add(1);
  //     setP.delete(1);
  //   }

  //   // map size修改
  //   {
  //     const mapP = reactive(new Map([["name", "wenye"]]));
  //     effect(() => {
  //       console.log("map触发");
  //       mapP.size;
  //     });
  //     mapP.set("age", 22);
  //     mapP.delete("age");
  //   }
  //   // map读取
  //   {
  //     const mapP = reactive(new Map([["name", "wenye"]]));
  //     effect(() => {
  //       console.log("map读取");
  //       // mapP.has("name");
  //       mapP.get("name");
  //     });
  //     mapP.set("name", "yiye");
  //   }
  //   // set读取
  //   {
  //     const p = reactive(new Set([]));
  //     effect(() => {
  //       console.log("set读取");
  //       p.has(1);
  //     });
  //     p.add(1);
  //     p.delete(1);
  //   }
  //   // set clear
  //   {
  //     const p = reactive(new Set([1, 2]));
  //     effect(() => {
  //       console.log("set clear");
  //       p.has(1);
  //       p.has(2);
  //     });
  //     p.delete(1);
  //     p.delete(2);
  //   }
  //   // map clear
  //   {
  //     const p = reactive(
  //       new Map([
  //         [1, 2],
  //         [3, 4],
  //       ])
  //     );
  //     effect(() => {
  //       console.log("map clear");
  //       p.has(1);
  //       p.has(3);
  //     });
  //     p.delete(1);
  //     p.delete(3);
  //   }

  //   // map循环参数主动响应化
  //   {
  //     const p = reactive(
  //       new Map([
  //         ["list", new Set([1, 2])],
  //         ["name", "wenye"],
  //       ])
  //     );
  //     effect(() => {
  //       console.log("map循环参数主动响应化");
  //       p.forEach((v) => v.size);
  //     });
  //     p.get("list").add(3);
  //     p.set("name", "yiye"); // 修改值也会导致触发
  //   }
  //   // set iterator
  //   {
  //     const set = reactive(new Set([{ name: "wenye" }]));
  //     effect(() => {
  //       console.log("set iterator");
  //       // for (let val of set) {
  //       // }
  //       // for (let val of set.entries()) {
  //       // }
  //       // for (let val of set.keys()) {
  //       // }
  //       for (let val of set.values()) {
  //       }
  //     });
  //     set.add(1);
  //   }
  //   // map iterator
  //   {
  //     const source = new Map([
  //       ["obj", { name: "wenye" }],
  //       [1, 2],
  //     ]);
  //     const map = reactive(source);
  //     effect(() => {
  //       console.log("map iterator");
  //       // for (let [key, value] of map) {
  //       //   value.name;
  //       // }
  //       // for (let [key, value] of map.entries()) {
  //       // }
  //       for (let key of map.keys()) {
  //       }
  //       // for (let value of map.values()) {
  //       // }
  //     });
  //     // source.get("obj").name = "yiye";
  //     // map.get("obj").name = "yiye";
  //     map.set(1, 3); // keys下设置值不需要更新
  //   }
  // }


  return exports;
})({});
