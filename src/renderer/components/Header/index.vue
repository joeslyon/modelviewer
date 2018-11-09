<template>
  <div class="header-view">
    <div class="left div-inline no-drag">
      <img width="32px" ondragstart="return false;" style="margin-left:2px;margin-top:2px" src="@/assets/icon.png" />
    </div>
    <div class="right div-inline">
      <el-button @click="refresh" class="no-drag" size="mini" type="text">
        <el-tooltip effect="dark" content="刷新页面" placement="bottom">
          <i class="btn my-el-icon-reload"></i>
        </el-tooltip>
      </el-button>
      <el-button @click="minimize" class="no-drag" size="mini" type="text">
        <el-tooltip effect="dark" content="最小化" placement="bottom">
          <i class="btn el-icon-minus"></i>
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
      <el-button @click="close" class="no-drag hover-color" size="mini" type="text">
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
    };
  },
  props: {
    height: {
      type: String,
      default: "40px"
    }
  },
  methods: {
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
    home() {
      this.$router.push({ name: "home" });
    },
    refresh() {
      this.$electron.ipcRenderer.send("ev_reload");
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
  }
}

.el-button + .el-button {
  margin-left: 0;
}

.no-drag {
  -webkit-app-region: no-drag;
}
</style>
