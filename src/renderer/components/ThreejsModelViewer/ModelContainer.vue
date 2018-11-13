<template>
  <div ref="modelViewer" class="modelViewer dragTarget">
    <model-collada v-if="current == '.dae'" :src="filePath" @on-load="onload"></model-collada>
    <model-gltf v-else-if="current == '.gltf' || current == '.glb'" :src="filePath" @on-load="onload"></model-gltf>
    <model-stl v-else-if="current == '.stl'" :src="filePath" @on-load="onload"></model-stl>
    <model-ply v-else-if="current == '.ply'" :src="filePath" @on-load="onload"></model-ply>
    <model-pcd v-else-if="current == '.pcd'" :src="filePath" @on-load="onload"></model-pcd>
    <model-obj v-else-if="current == '.obj'" :src="filePath" @on-load="onload"></model-obj>
    <markdown-viewer v-else-if="current == '.md'" :src="filePath"></markdown-viewer>
  </div>
</template>

<script>
import Vue from "vue";
const { BrowserWindow } = require("electron");
import VueModel from "./VueModel";

Vue.use(VueModel);

export default {
  props: ["fileInfo"],
  data() {
    return {
      current: undefined,
      filePath: ""
    };
  },
  watch: {
    fileInfo(val, old) {
      this.loadModel(val);
    }
  },
  methods: {
    loadModel(fileInfo) {
      let type = fileInfo.ext;
      let path = fileInfo.path.replace(/\\/g, "/");
      this.current = type;
      this.filePath = path;
    },
    onload() {},
    switchModelViewer(type) {
      this.current = type;
    }
  },
  mounted() {
    let that = this;
    this.$nextTick(function() {
      //注册拖拽事件
      let holder = that.$refs.modelViewer;
      holder.ondrop = function(event) {
        event.preventDefault();
        event.stopPropagation();
        let efile = event.dataTransfer.files[0];
        if (!efile || !efile.path) return;
        that.$emit("importFile", efile.path);
      };
      that.$electron.ipcRenderer.on("switch-type", (event, { data }) => {
        that.switchModelViewer(data);
      });
      that.loadModel(that.fileInfo);
    });
  }
};
</script>

<style scoped>
.modelViewer {
  width: 100%;
  height: 100%;
  padding: 0;
  margin: 0;
}
</style>
