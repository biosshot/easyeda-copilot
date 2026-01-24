<template>
    <div class="completions-view">
        <!-- Header section -->
        <div class="completions-header">
            <div class="header-content">
                <h2>Circuit Completions</h2>
                <p class="header-description">Generate and apply suggestions to complete your circuit</p>
            </div>
            <IconButton class="refresh-button" @click="generateCompletions" :disabled="isLoading"
                :title="isLoading ? 'Generating completions...' : 'Generate new completions'" :size="18"
                icon="RotateCw" />
        </div>

        <div v-if="errorMessage" class="error-container">
            <ErrorBanner :message="errorMessage" />
        </div>

        <!-- Loading indicator -->
        <div v-if="isLoading" class="loading-container">
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                <div class="loading-spinner">
                    <TypingDots :status="progressStatus || 'Generating suggestions...'" />
                </div>
                <IconButton class="cancel-button" @click="cancelRequest" :size="16" icon="CircleStop">
                    Cancel
                </IconButton>
                <Timer />
            </div>
        </div>

        <!-- Main content -->
        <div v-else class="completions-content">
            <!-- Suggestions list -->
            <div class="suggestions-section">
                <h3>Suggestions</h3>
                <div v-if="suggestions.length === 0" class="empty-state">
                    <Icon name="Zap" size="32" />
                    <p>No suggestions available</p>
                    <p class="hint">Click the refresh button above to generate suggestions</p>
                </div>

                <div v-else class="suggestions-list">
                    <button v-for="(suggestion, index) in suggestions" :key="index" class="suggestion-item"
                        :class="{ selected: selectedSuggestion === index }" @click="selectSuggestion(index)">
                        <div class="suggestion-content">
                            <span class="suggestion-title">{{ suggestion.title }}</span>
                            <span class="suggestion-description">{{ suggestion.description }}</span>
                        </div>
                        <Icon v-if="selectedSuggestion === index" name="Check" size="18" />
                    </button>
                </div>
            </div>

            <!-- Custom action section -->
            <div class="action-section">
                <h3>Custom Action</h3>
                <div class="input-group">
                    <textarea v-model="customAction" class="action-input"
                        placeholder="Enter a custom action or modification for your circuit..."
                        :disabled="isLoading"></textarea>
                    <div class="input-info">
                        <span class="char-count">{{ customAction.length }} characters</span>
                    </div>
                </div>
            </div>

            <!-- Action buttons -->
            <div class="action-buttons">
                <IconButton :size="16" icon="Play" class="apply-button" :disabled="!canApply || isLoading"
                    @click="applyAction">
                    Apply
                </IconButton>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useCompletions } from '../../composables/useCompletions';
import Icon from '../shared/Icon.vue';
import TypingDots from '../shared/TypingDots.vue';
import IconButton from '../shared/IconButton.vue';
import Timer from '../shared/Timer.vue';
import ErrorBanner from '../shared/ErrorBanner.vue';

const {
    suggestions,
    selectedSuggestion,
    customAction,
    isLoading,
    progressStatus,
    canApply,
    errorMessage,
    generateCompletions,
    applyAction,
    selectSuggestion,
    cancelRequest,
} = useCompletions();

</script>

<style scoped>
.completions-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--color-background);
    color: var(--color-text);
    padding: 0;
    overflow: hidden;
}

/* Header */
.completions-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 16px 20px;
    gap: 16px;
}

.header-content h2 {
    margin: 0 0 4px 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-text);
}

.header-description {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
}

.refresh-button {
    flex-shrink: 0;
    padding: 8px 12px;
    background: var(--color-primary);
    color: var(--color-text-on-primary);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
    font-size: 0.9rem;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.refresh-button:hover:not(:disabled) {
    background: var(--color-primary-dark);
    transform: translateY(-1px);
}

.refresh-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.refresh-button .spin {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

/* Loading container */
.loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 40px 20px;
}

.loading-spinner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
}

/* Main content */
.completions-content {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0;
}

/* Suggestions section */
.suggestions-section {
    flex: 0 1 50%;
    padding: 20px;
    border-bottom: 1px solid var(--color-border);
    overflow-y: auto;
}

.suggestions-section h3 {
    margin: 0 0 12px 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: var(--color-text-secondary);
    text-align: center;
}

.empty-state svg {
    color: var(--color-text-tertiary);
    margin-bottom: 12px;
    opacity: 0.5;
}

.empty-state p {
    margin: 4px 0;
}

.empty-state .hint {
    font-size: 0.85rem;
    color: var(--color-text-tertiary);
}

.suggestions-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.suggestion-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    text-align: left;
    gap: 12px;
}

.suggestion-item:hover {
    background: var(--color-surface-hover);
    border-color: var(--color-primary);
}

.suggestion-item.selected {
    background: var(--color-surface-active);
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(16, 163, 127, 0.1);
}

.suggestion-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.suggestion-title {
    font-weight: 500;
    color: var(--color-text);
    font-size: 0.95rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.suggestion-description {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Action section */
.action-section {
    flex: 1;
    padding: 20px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.action-section h3 {
    margin: 0 0 12px 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
}

.input-group {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 8px;
}

.action-input {
    flex: 1;
    padding: 12px 14px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text);
    font-family: inherit;
    font-size: 0.9rem;
    line-height: 1.5;
    resize: none;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.action-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(16, 163, 127, 0.1);
}

.action-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.input-info {
    display: flex;
    justify-content: flex-end;
    padding: 0 4px;
}

.char-count {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
}

/* Action buttons */
.action-buttons {
    display: flex;
    gap: 10px;
    padding: 16px 20px;
    border-top: 1px solid var(--color-border);
}

.apply-button,
.cancel-button {
    padding: 4px 8px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.apply-button {
    background: var(--color-primary);
    color: var(--color-text-on-primary);
    flex: 1;
}

.apply-button:hover:not(:disabled) {
    background: var(--color-primary-dark);
    transform: translateY(-1px);
}

.apply-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.cancel-button {
    background: var(--color-error);
    color: white;
    padding: 5px 6px;
}

.cancel-button:hover {
    opacity: 0.9;
    transform: translateY(-1px);
}

.status-text {
    margin: 0;
    color: var(--color-text);
    font-size: 0.95rem;
    text-align: center;
    max-width: 200px;
}

.typing-dots {
    display: flex;
    gap: 4px;
    align-items: flex-end;
}

.dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-primary);
    animation: typing 1.4s infinite;
}

.dot:nth-child(1) {
    animation-delay: 0s;
}

.dot:nth-child(2) {
    animation-delay: 0.2s;
}

.dot:nth-child(3) {
    animation-delay: 0.4s;
}

@keyframes typing {

    0%,
    60%,
    100% {
        transform: translateY(0);
        opacity: 0.7;
    }

    30% {
        transform: translateY(-8px);
        opacity: 1;
    }
}

.cancel-overlay-button {
    padding: 8px 16px;
    background: var(--color-error);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.cancel-overlay-button:hover {
    opacity: 0.9;
    transform: translateY(-1px);
}

.error-container {
    display: flex;
    justify-content: center;
}
</style>