<template>
  <div class="container">
    <el-container id="main">
      <el-header :class="[{'fullscreen':fullscreen},'header']" height="36px" style="-webkit-app-region: drag">
        <header-view @app-data="appEvent"></header-view>
      </el-header>
      <el-main class="main">
        <config-container v-show="appConfig" :appData="appData" @close="appConfig = false">
        </config-container>
        <threejs-model-viewer :class="[{'showViewer':appConfig}]"></threejs-model-viewer>
      </el-main>
    </el-container>
  </div>
</template>
<script>
import HeaderView from "@/components/Header";
import ConfigContainer from "@/components/ConfigContainer";
import ThreejsModelViewer from "@/components/ThreejsModelViewer";

const { BrowserWindow, shell } = require("electron");

export default {
  data() {
    return {
      fullscreen: false,
      appConfig: false,
      appData: {}
    };
  },
  components: { HeaderView, ConfigContainer, ThreejsModelViewer },
  methods: {
    appEvent(data) {
      if (!data) return;
      this.appConfig = true;
      this.appData = data;
    }
  },
  created() {
    let that = this;
    //监听窗体大小变化
    this.$electron.ipcRenderer.on("fullscreen", (event, { data }) => {
      switch (data) {
        case "enter":
          that.fullscreen = true;
          break;
        case "leave":
          that.fullscreen = false;
          break;
        default:
          break;
      }
    });
    //检测当前窗口状态是否为全屏
    let win = this.$electron.remote.getCurrentWindow();
    if (win && win.isFullScreen()) {
      this.fullscreen = true;
    }
    this.$nextTick(function() {
      document.addEventListener("click", function(event) {
        event.preventDefault();
        if (event.path && event.path[0]) {
          var a = event.path[0];
          if (a.href) {
            shell.openExternal(a.href);
          }
        }
      });
    });
  }
};
</script>

<style scoped>
.container,
#main {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.main {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.header {
  margin: 0;
  padding: 0;
  width: 100%;
}

.fullscreen {
  display: none;
}

.showViewer {
  display: none;
}
</style>