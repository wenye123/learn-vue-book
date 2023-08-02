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
  function createReactive(data, isShallow = false, isReadonly = false) {
    return new Proxy(data, {
      get(source, key, p) {
        // 给p增加_raw字段返回sourse
        if (key === "_raw") return source;
        const res = Reflect.get(source, key, p);
        // 非只读才收集依赖
        if (isReadonly === false) {
          track(source, key);
        }
        // 浅响应
        if (isShallow === true) return res;
        // 深响应 对象则递归
        if (typeof res === "object" && res !== null) {
          return isReadonly
            ? createReactive(res, false, true)
            : createReactive(res, false, false);
        } else {
          return res;
        }
      },
      // has判断 key in obj
      has(source, key) {
        // 非只读才收集依赖
        if (isReadonly === false) {
          track(source, key);
        }
        return Reflect.has(source, key);
      },
      // ownKeys判断for in
      ownKeys(source) {
        // 非只读才收集依赖
        if (isReadonly === false) {
          track(source, INTERATE_KEY);
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
        const type = Object.prototype.hasOwnProperty.call(source, key)
          ? TriggerType.SET
          : TriggerType.ADD;
        const res = Reflect.set(source, key, newVal, p);
        // 直接访问的代理对象才触发
        if (p._raw === source) {
          // 新旧值不相等才触发 并且有一个不是NaN
          if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
            trigger(source, key, type); // 传递第三个参数
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
  function shallowReactive(data) {
    return createReactive(data, true, false);
  }
  function reactive(data) {
    return createReactive(data, false, false);
  }
  function shallowReadonly(data) {
    return createReactive(data, true, true);
  }
  function readonly(data) {
    return createReactive(data, false, true);
  }
  function track(source, key) {
    if (!activeEffect) return;
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
  function trigger(source, key, type) {
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

  {
    // 深响应
    let obj = reactive({
      info: {
        name: "wenye",
      },
    });
    // 浅响应
    obj = shallowReactive({
      info: {
        name: "wenye",
      },
    });
    // 浅只读
    obj = shallowReadonly({
      info: {
        name: "wenye",
      },
    });
    // 深只读
    obj = readonly({
      info: {
        name: "wenye",
      },
    });
    effect(() => {
      console.log("触发");
      obj.info.name;
      // "name" in obj.info;
      // for (let i in obj.info) {}
    });
    // obj.info = 11;
    // delete obj.info;
    obj.info.name = "yiye";
    delete obj.info.name;
  }
})();
