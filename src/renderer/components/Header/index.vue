<template>
  <div class="header-view">
    <div class="left div-inline no-drag">
      <img width="32px" ondragstart="return false;" style="margin-left:2px;margin-top:2px" src="@/assets/icon.png" />
    </div>
    <div class="right div-inline">
      <el-button @click="help" class="no-drag" size="mini" type="text">
        <el-tooltip effect="dark" content="使用说明" placement="bottom">
          <i class="btn el-icon-question"></i>
        </el-tooltip>
      </el-button>
      <el-button @click="setting" class="no-drag" size="mini" type="text">
        <el-tooltip effect="dark" content="设置" placement="bottom">
          <i class="btn el-icon-setting"></i>
        </el-tooltip>
      </el-button>
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
    <el-dialog :visible.sync="dialogFormVisible" width="80%">
      <div v-html="docContent" class="markdown-body"></div>
    </el-dialog>
  </div>
</template>

<script>
import "github-markdown-css/github-markdown.css";
const { BrowserWindow } = require("electron");
var fs = require("fs");
var markdown = require("markdown").markdown;

export default {
  data() {
    return {
      win_normal: true,
      dialogFormVisible: false,
      docContent: ""
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
    refresh() {
      this.$electron.ipcRenderer.send("ev_reload");
    },
    help() {
      this.dialogFormVisible = true;
    },
    setting() {}
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
    var that = this;
    this.$nextTick(function() {
      fs.readFile("static/help.md", function(err, data) {
        if (err) {
          return console.error(err);
        }
        that.docContent = markdown.toHTML(data.toString());
      });
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
