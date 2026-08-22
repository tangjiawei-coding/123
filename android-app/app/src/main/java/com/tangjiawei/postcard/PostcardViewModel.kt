package com.tangjiawei.postcard

import android.app.Application
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tangjiawei.postcard.data.ApiClient
import com.tangjiawei.postcard.data.AppPreferences
import com.tangjiawei.postcard.data.CommunityComment
import com.tangjiawei.postcard.data.CommunityPost
import com.tangjiawei.postcard.data.GenerateRequest
import com.tangjiawei.postcard.data.Skill
import com.tangjiawei.postcard.util.ImageUtils
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers

data class CreationState(
    val preview: Bitmap? = null,
    val uploadDataUrl: String? = null,
    val description: String = "",
    val mode: String = "fast",
    val skills: List<Skill> = emptyList(),
    val skillId: String = "photo-abstract-editorial",
    val preparing: Boolean = false,
    val generating: Boolean = false,
    val elapsedSeconds: Int = 0,
    val generatedImageValue: String? = null,
    val generatedBitmap: Bitmap? = null,
    val sentence: String = "",
    val error: String? = null,
    val message: String? = null,
)

data class CommunityState(
    val posts: List<CommunityPost> = emptyList(),
    val page: Int = 1,
    val total: Int = 0,
    val loading: Boolean = false,
    val error: String? = null,
    val selectedPost: CommunityPost? = null,
    val comments: List<CommunityComment> = emptyList(),
    val commentsLoading: Boolean = false,
)

class PostcardViewModel(application: Application) : AndroidViewModel(application) {
    val preferences = AppPreferences(application)
    private val api = ApiClient(preferences)

    private val _creation = MutableStateFlow(CreationState())
    val creation: StateFlow<CreationState> = _creation.asStateFlow()

    private val _community = MutableStateFlow(CommunityState())
    val community: StateFlow<CommunityState> = _community.asStateFlow()

    private var generationJob: Job? = null
    private var timerJob: Job? = null

    init {
        loadSkills()
        refreshCommunity()
    }

    fun selectImage(uri: Uri) {
        viewModelScope.launch {
            _creation.update { it.copy(preparing = true, error = null, message = null) }
            runCatching {
                withContext(Dispatchers.IO) { ImageUtils.prepareUpload(getApplication<Application>().contentResolver, uri) }
            }.onSuccess { prepared ->
                _creation.update { it.copy(preview = prepared.preview, uploadDataUrl = prepared.dataUrl, preparing = false) }
            }.onFailure { error ->
                _creation.update { it.copy(preparing = false, error = error.message ?: "图片处理失败") }
            }
        }
    }

    fun clearImage() = _creation.update {
        it.copy(preview = null, uploadDataUrl = null, generatedImageValue = null, generatedBitmap = null, sentence = "", error = null)
    }

    fun setDescription(value: String) = _creation.update { it.copy(description = value) }
    fun setMode(value: String) = _creation.update { it.copy(mode = value) }
    fun setSkill(value: String) = _creation.update { it.copy(skillId = value) }
    fun clearNotice() = _creation.update { it.copy(error = null, message = null) }

    fun generate() {
        val state = _creation.value
        val image = state.uploadDataUrl ?: return
        generationJob?.cancel()
        generationJob = viewModelScope.launch {
            _creation.update { it.copy(generating = true, elapsedSeconds = 0, error = null, message = null) }
            timerJob = launch {
                while (true) {
                    delay(1000)
                    _creation.update { it.copy(elapsedSeconds = it.elapsedSeconds + 1) }
                }
            }
            runCatching {
                api.generate(GenerateRequest(image, state.description, state.mode, state.skillId))
            }.onSuccess { result ->
                val bitmap = ImageUtils.decodeDataUrl(result.image) ?: runCatching {
                    withContext(Dispatchers.IO) {
                        api.imageBytes(result.image).let { BitmapFactory.decodeByteArray(it, 0, it.size) }
                    }
                }.getOrNull()
                _creation.update {
                    it.copy(
                        generating = false,
                        generatedImageValue = result.image,
                        generatedBitmap = bitmap,
                        sentence = result.sentence,
                        message = "生成完成",
                    )
                }
            }.onFailure { error ->
                if (generationJob?.isCancelled != true) {
                    _creation.update { it.copy(generating = false, error = error.message ?: "生成失败") }
                }
            }
            timerJob?.cancel()
        }
    }

    fun cancelGeneration() {
        generationJob?.cancel()
        timerJob?.cancel()
        _creation.update { it.copy(generating = false, message = "已停止等待") }
    }

    fun publish(title: String, description: String, onDone: (Boolean) -> Unit) {
        val state = _creation.value
        val image = state.generatedImageValue ?: return onDone(false)
        viewModelScope.launch {
            runCatching {
                api.publish(
                    image = image,
                    sentence = state.sentence,
                    author = preferences.nickname.ifBlank { "匿名用户" },
                    title = title,
                    description = description,
                )
            }.onSuccess {
                _creation.update { it.copy(message = "已发布到社区") }
                refreshCommunity()
                onDone(true)
            }.onFailure { error ->
                _creation.update { it.copy(error = error.message ?: "发布失败") }
                onDone(false)
            }
        }
    }

    fun refreshCommunity() = loadCommunity(reset = true)

    fun loadMore() {
        val state = _community.value
        if (!state.loading && state.posts.size < state.total) loadCommunity(reset = false)
    }

    private fun loadCommunity(reset: Boolean) {
        if (_community.value.loading) return
        val targetPage = if (reset) 1 else _community.value.page + 1
        viewModelScope.launch {
            _community.update { it.copy(loading = true, error = null) }
            runCatching { api.posts(targetPage) }
                .onSuccess { page ->
                    _community.update {
                        it.copy(
                            posts = if (reset) page.posts else it.posts + page.posts,
                            page = targetPage,
                            total = page.total,
                            loading = false,
                        )
                    }
                }
                .onFailure { error -> _community.update { it.copy(loading = false, error = error.message ?: "社区加载失败") } }
        }
    }

    fun openPost(post: CommunityPost) {
        _community.update { it.copy(selectedPost = post, comments = emptyList(), commentsLoading = true) }
        viewModelScope.launch {
            runCatching { api.comments(post.id) }
                .onSuccess { comments -> _community.update { it.copy(comments = comments, commentsLoading = false) } }
                .onFailure { error -> _community.update { it.copy(commentsLoading = false, error = error.message) } }
        }
    }

    fun closePost() = _community.update { it.copy(selectedPost = null, comments = emptyList()) }

    fun toggleLike(post: CommunityPost) {
        viewModelScope.launch {
            runCatching { api.toggleLike(post.id, preferences.visitorId) }
                .onSuccess { result ->
                    _community.update { state ->
                        val updated = state.posts.map { item ->
                            if (item.id != post.id) item else item.copy(
                                likes = result.likes,
                                likers = if (result.liked) item.likers + preferences.visitorId else item.likers - preferences.visitorId,
                            )
                        }
                        state.copy(posts = updated, selectedPost = state.selectedPost?.let { selected -> updated.find { it.id == selected.id } })
                    }
                }
                .onFailure { error -> _community.update { it.copy(error = error.message ?: "点赞失败") } }
        }
    }

    fun sendComment(content: String) {
        val post = _community.value.selectedPost ?: return
        if (content.isBlank()) return
        viewModelScope.launch {
            runCatching { api.comment(post.id, preferences.nickname.ifBlank { "匿名用户" }, content.trim()) }
                .onSuccess { comment ->
                    _community.update { state ->
                        val posts = state.posts.map { if (it.id == post.id) it.copy(commentCount = it.commentCount + 1) else it }
                        state.copy(posts = posts, comments = state.comments + comment, selectedPost = posts.find { it.id == post.id })
                    }
                }
                .onFailure { error -> _community.update { it.copy(error = error.message ?: "评论失败") } }
        }
    }

    fun saveSettings(baseUrl: String, nickname: String, onChecked: (Boolean, String) -> Unit) {
        preferences.baseUrl = baseUrl
        preferences.nickname = nickname
        viewModelScope.launch {
            runCatching { api.healthCheck() }
                .onSuccess {
                    loadSkills()
                    refreshCommunity()
                    onChecked(true, "服务连接成功")
                }
                .onFailure { onChecked(false, it.message ?: "无法连接服务") }
        }
    }

    private fun loadSkills() {
        viewModelScope.launch {
            runCatching { api.skills() }
                .onSuccess { skills -> _creation.update { it.copy(skills = skills, skillId = skills.firstOrNull()?.id ?: it.skillId) } }
                .onFailure {
                    _creation.update {
                        it.copy(skills = listOf(Skill("photo-abstract-editorial", "象牙抽象编辑")))
                    }
                }
        }
    }

    fun imageUrl(value: String): String = api.absoluteImageUrl(value)
}
