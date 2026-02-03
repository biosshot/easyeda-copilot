<template>
  <div v-if="isAvatar">
    <img :src="name" :style="{ width: '100%', borderRadius: '50%', objectFit: 'cover' }" @error="handleImageError" />
  </div>
  <component v-else style="margin: 5px;" :is="iconComponent" :size="props.size ?? 24" :color="props.color" />
</template>

<script setup lang="ts">
import { computed, FunctionalComponent, ref, watch } from 'vue';
import {
  CircleAlert, RotateCw, Play, Zap, Cpu, CircleStop, User, Send, FileText, Search,
  MessageSquare, BoxSelect, AudioWaveform, Settings, PauseCircle, Plus, History,
  X, Trash2, SendHorizonal, ListRestart, ChevronUp, ChevronDown, Check, Replace,
  CircleCheckBig, Pencil, Bookmark, Trash, Square, Pause, CodeXml, Image, Wrench, Save,
  FileDown, TriangleAlert
} from 'lucide-vue-next';

const icons: Record<string, FunctionalComponent> = {
  Zap, Cpu, User, Send, FileText, Search, MessageSquare,
  BoxSelect, AudioWaveform, Settings, PauseCircle, Plus,
  History, X, Trash2, SendHorizonal, CircleStop, ListRestart,
  ChevronUp, ChevronDown, Check, Play, CircleAlert, RotateCw, Replace,
  CircleCheckBig, Pencil, Bookmark, Square, Pause, Trash, CodeXml, Image, Wrench, Save,
  FileDown, TriangleAlert
};

const props = defineProps<{
  name: string;
  color?: string;
  size?: number | string;
  failName?: string;
}>();

const name = ref<string>(props.name);

watch([props], () => {
  console.log(props.name)
  name.value = props.name;
})

const isAvatar = computed(() => {
  return (
    name.value.startsWith('http://') ||
    name.value.startsWith('https://') ||
    name.value.startsWith('data:')
  );
});

const iconComponent = computed(() => {
  if (icons[name.value]) return icons[name.value];
  console.warn('Icon not found:', name.value, icons);
  return icons.Zap;
});

function handleImageError() {
  if (props.failName && props.failName !== props.name) {
    name.value = props.failName;
  } else {
    name.value = 'User'; // или любое другое имя иконки по умолчанию
  }
}
</script>