<template>
    <div class="wrapper">
        <electron-iframe :relative="relative" src="static/mapshaper/index.html"></electron-iframe>
    </div>
</template>

<script>
import ElectronIframe from "@/components/ElectronIframe";
export default {
  name: "map-shaper",
  components: { ElectronIframe },
  data() {
    return {
      relative: true
    };
  }
};
</script>

<style scoped>
.wrapper {
  padding: 0;
  margin: 0;
  width: 100%;
  height: 100%;
}
</style>