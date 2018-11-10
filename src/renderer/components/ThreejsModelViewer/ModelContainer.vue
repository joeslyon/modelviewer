<template>
  <div ref="modelViewer" class="modelViewer dragTarget">
    <model-collada v-if="current == '.dae'" :src="filePath"></model-collada>
    <model-gltf v-else-if="current == '.gltf' || current == '.glb'" :src="filePath"></model-gltf>
    <model-stl v-else-if="current == '.stl'" :src="filePath"></model-stl>
    <model-ply v-else-if="current == '.ply'" :src="filePath"></model-ply>
    <!-- <model-pcd v-else-if="current == '.pcd'" :src="filePath"></model-pcd> -->
    <model-obj v-else-if="current == '.obj'" :src="filePath"></model-obj>
    <!-- <model-draco v-else-if="current == '.drc'" :src="filePath"></model-draco> -->
  </div>
</template>

<script>
import {
  ModelStl,
  ModelPly,
  ModelCollada,
  ModelGltf,
  ModelObj,
  ModelDraco,
  ModelPcd
} from "./VueModel";

export default {
  components: {
    ModelStl,
    ModelPly,
    ModelCollada,
    ModelGltf,
    ModelObj,
    ModelDraco,
    ModelPcd
  },
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
