<template>
  <div class="header-view">
    <div class="left div-inline no-drag">
      <img width="32px" ondragstart="return false;" style="margin-left:2px;margin-top:2px" src="@/assets/icon.png" />
    </div>
    <div class="right div-inline">
      <el-button v-for="tool in right" :key="tool.id" @click="clickMethod(tool.func)" class="no-drag" size="mini" type="text">
        <el-tooltip effect="dark" :content="tool.desc" placement="bottom">
          <i :class="tool.icon"></i>
        </el-tooltip>
      </el-button>
      <el-button @click="maximum" class="no-drag" size="mini" type="text">
        <el-tooltip v-if="win_normal" effect="dark" content="最大化" placement="bottom">
          <i class="btn my-el-icon-winmax"></i>
        </el-tooltip>
        <el-tooltip v-else effect="dark" content="还原" placement="bottom">
          <i class="btn my-el-icon-winrestore"></i>
        </el-tooltip>
      </el-button>
      <el-button @click="close" class="no-drag" size="mini" type="text">
        <el-tooltip effect="dark" content="关闭应用" placement="bottom">
          <i class="btn el-icon-close"></i>
        </el-tooltip>
      </el-button>
    </div>
  </div>
</template>

<script>
const { BrowserWindow } = require("electron");

export default {
  data() {
    return {
      win_normal: true,
      left: [
        {
          id: "0",
          func: "mapshaper",
          icon: "btn el-icon-question",
          desc: "mapshaper"
        }
      ],
      right: [
        {
          id: "0",
          func: "help",
          icon: "btn el-icon-question",
          desc: "使用说明"
        },
        {
          id: "1",
          func: "history",
          icon: "btn el-icon-document",
          desc: "历史记录"
        },
        {
          id: "2",
          func: "setting",
          icon: "btn el-icon-setting",
          desc: "设置"
        },
        {
          id: "3",
          func: "mapshaper",
          icon: "btn el-icon-menu",
          desc: "MapShaper"
        },
        {
          id: "4",
          func: "refresh",
          icon: "btn my-el-icon-reload",
          desc: "刷新页面"
        },
        {
          id: "5",
          func: "minimize",
          icon: "btn el-icon-minus",
          desc: "最小化"
        }
      ]
    };
  },
  props: {
    height: {
      type: String,
      default: "40px"
    }
  },
  methods: {
    clickMethod(name) {
      this.$options.methods[name].apply(this);
    },
    close() {
      this.$confirm("此操作将退出应用, 是否继续?", "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      })
        .then(() => {
          this.$electron.ipcRenderer.send("ev_close");
        })
        .catch(() => {});
    },
    maximum() {
      this.$electron.ipcRenderer.send("ev_maximum");
    },
    minimize() {
      this.$electron.ipcRenderer.send("ev_minimize");
    },
    refresh() {
      this.$electron.ipcRenderer.send("ev_reload");
    },
    help() {
      this.$emit("app-data", { type: "help" });
    },
    history() {
      this.$emit("app-data", { type: "history" });
    },
    setting() {
      this.$emit("app-data", { type: "setting" });
    },
    mapshaper() {
      this.$emit("app-data", { type: "mapshaper" });
    }
  },
  created() {
    let that = this;
    //监听窗体大小变化
    this.$electron.ipcRenderer.on("win_state", (event, { data }) => {
      switch (data) {
        case "max":
          that.win_normal = false;
          break;
        case "unmax":
          that.win_normal = true;
          break;
        default:
          break;
      }
    });
  },
  mounted() {
    let win = this.$electron.remote.getCurrentWindow();
    if (win && win.isMaximized()) {
      this.win_normal = false;
    }
  }
};
</script>

<style lang="scss" scoped>
@import url(../../assets/iconfont/iconfont.css);
.header-view {
  align-items: center;
  justify-content: space-between;

  .div-inline {
    display: inline;
  }

  .right {
    float: right;
    margin-right: 10px;
    .btn {
      font-size: 17px;
      color: #333;
    }
    .btn:hover {
      color: #31c27c;
    }
  }

  .left {
    height: 100%;
    float: left;
    .btn {
      font-size: 17px;
      color: #333;
    }
    .btn:hover {
      color: #31c27c;
    }
  }
}

.el-button + .el-button {
  margin-left: 0;
}

.no-drag {
  -webkit-app-region: no-drag;
}
</style>
