(() => {
  const { reactive, effect } = Vue;

  const REF_KEY = "__v_isRef";

  function ref(val) {
    const wrapper = {
      value: val,
    };
    Object.defineProperty(wrapper, REF_KEY, {
      value: true,
    });
    return reactive(wrapper);
  }

  function toRef(obj, key) {
    const wrapper = {
      get value() {
        return obj[key];
      },
      set value(val) {
        obj[key] = val;
      },
    };
    Object.defineProperty(wrapper, REF_KEY, {
      value: true,
    });
    return wrapper;
  }

  function toRefs(obj) {
    const ret = {};
    for (let key in obj) {
      ret[key] = toRef(obj, key);
    }
    return ret;
  }

  function proxyRefs(source) {
    return new Proxy(source, {
      get(source, key, receiver) {
        const val = Reflect.get(source, key, receiver);
        return val[REF_KEY] ? val.value : val;
      },
      set(source, key, nVal, receiver) {
        // 获取原始值
        const oVal = source[key];
        // 如果原始值是ref对象 则直接设置值
        if (oVal[REF_KEY]) {
          oVal.value = nVal;
          return true;
        }
        // 否则正常设置
        return Reflect.set(source, key, nVal, receiver);
      },
    });
  }

  // 示例
  {
    {
      const num = ref(0);
      effect(() => {
        console.log("ref");
        num.value;
      });
      num.value++;
    }
    {
      const obj = reactive({ name: "wenye" });
      const nobj = { ...obj };
      effect(() => {
        console.log("响应丢失");
        nobj.name;
      });
      obj.name = "yiye";
    }
    {
      const obj = reactive({ name: "wenye" });
      const nobj = toRefs(obj);
      effect(() => {
        console.log("toRefs");
        nobj.name.value;
      });
      // obj.name = "yiye";
      nobj.name.value = "yiye";
    }
    {
      const obj = reactive({ name: "wenye" });
      const nobj = proxyRefs(toRefs(obj));
      effect(() => {
        console.log("proxyRefs");
        nobj.name;
      });
      // obj.name = "yiye";
      nobj.name = "yiye";
    }
  }
})();
