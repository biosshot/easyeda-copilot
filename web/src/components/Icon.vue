<template>
  <component style="margin: 6px;" :is="iconComponent" :size="size" :color="color" />
</template>

<script setup>
import { computed } from 'vue';
import { CircleAlert, RotateCw, Play, Zap, Cpu, CircleStop, User, Send, FileText, Search, MessageSquare, BoxSelect, AudioWaveform, Settings, PauseCircle, Plus, History, X, Trash2, SendHorizonal, ListRestart, ChevronUp, ChevronDown, Check, Replace } from 'lucide-vue-next';

const icons = {
  Zap, Cpu, User, Send, FileText, Search, MessageSquare,
  BoxSelect, AudioWaveform, Settings, PauseCircle, Plus,
  History, X, Trash2, SendHorizonal, CircleStop, ListRestart,
  ChevronUp, ChevronDown, Check, Play, CircleAlert, RotateCw, Replace
};

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  size: {
    type: [String, Number],
    default: 24
  },
  color: {
    type: String,
    default: 'currentColor'
  }
});

const iconComponent = computed(() => {
  if (icons[props.name]) return icons[props.name];
  console.warn("Not found Icon", props.name, icons);
  return icons.Zap;
});
</script>
