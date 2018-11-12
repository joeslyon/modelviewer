<template>
  <div class="container">
    <el-container id="main">
      <el-header :class="[{'fullscreen':fullscreen},'header']" height="36px" style="-webkit-app-region: drag">
        <header-view @app-data="appEvent"></header-view>
      </el-header>
      <el-main class="main">
        <threejs-model-viewer></threejs-model-viewer>
      </el-main>
    </el-container>
  </div>
</template>
<script>
import HeaderView from "@/components/Header";
import ThreejsModelViewer from "@/components/ThreejsModelViewer";
const { BrowserWindow } = require("electron");

export default {
  data() {
    return {
      fullscreen: false
    };
  },
  components: { HeaderView, ThreejsModelViewer },
  methods: {
    appEvent(data) {
      let win = this.$electron.remote.getCurrentWindow();
      win.webContents.send("app-data", data);
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
</style>