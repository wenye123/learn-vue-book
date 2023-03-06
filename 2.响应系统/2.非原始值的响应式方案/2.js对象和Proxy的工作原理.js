(() => {
  // 对象拦截操作
  {
    const obj = {
      name: "wenye",
      age: 28,
    };
    const p = new Proxy(obj, {
      get(target, key, receiver) {
        console.log("get");
        return Reflect.get(target, key, receiver);
      },
      set(target, key, receiver) {
        console.log("set");
        return Reflect.set(target, key, receiver);
      },
      deleteProperty(target, key) {
        console.log("deleteProperty");
        return Reflect.deleteProperty(target, key);
      },

      has(target, key) {
        console.log("has");
        return Reflect.has(target, key);
      },
      ownKeys(target) {
        console.log("ownKeys");
        return Reflect.ownKeys(target);
      },

      getOwnPropertyDescriptor(target, propKey) {
        console.log("getOwnPropertyDescriptor");
        return Reflect.getOwnPropertyDescriptor(target, propKey);
      },
      defineProperty(target, propKey, propDesc) {
        console.log("defineProperty");
        return Reflect.defineProperty(target, propKey, propDesc);
      },

      preventExtensions(target) {
        console.log("preventExtensions");
        return Reflect.preventExtensions(target);
      },
      isExtensible(target) {
        console.log("isExtensible");
        return Reflect.isExtensible(target);
      },

      getPrototypeOf(target) {
        console.log("getPrototypeOf");
        return Reflect.getPrototypeOf(target);
      },
      setPrototypeOf(target, proto) {
        console.log("setPrototypeOf");
        return Reflect.setPrototypeOf(target, proto);
      },
    });

    p.name;
    p.name = "yiye";
    delete p.age;

    "name" in p;
    // Object.keys(p); // 这个操作也会触发getOwnPropertyDescriptor
    Object.getOwnPropertyNames(p);

    Object.getOwnPropertyDescriptor(p, "name");
    Object.defineProperty(p, "age", {});

    Object.getPrototypeOf(p);
    Object.setPrototypeOf(p, null); // 如果对象调用了preventExtensions()后执行这条语句会报错

    Object.preventExtensions(p);
    Object.isExtensible(p);
  }

  // 函数拦截操作
  {
    function fn(name) {
      return name;
    }
    const p = new Proxy(fn, {
      apply(target, thisArg, args) {
        console.log("apply");
        return Reflect.apply(target, thisArg, args);
      },
      construct(target, args, newTarget) {
        console.log("construct");
        return Reflect.construct(target, args, newTarget);
      },
    });

    p();
    new p();
  }

  // 代理一些原生对象 需要绑定this
  {
    const date = new Date("2023/01/02");
    const p = new Proxy(date, {
      get(target, key, receiver) {
        if (typeof target[key] === 'function') {
          return target[key].bind(target);
        } else {
          return Reflect.get(target, key, receiver);
        }
      },
    });
    console.log(p.getDate());
  }
})();
