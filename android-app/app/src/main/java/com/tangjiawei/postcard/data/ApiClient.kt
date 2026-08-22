package com.tangjiawei.postcard.data

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class ApiClient(private val preferences: AppPreferences) {
    private val gson = Gson()
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .readTimeout(7, TimeUnit.MINUTES)
        .callTimeout(8, TimeUnit.MINUTES)
        .build()

    suspend fun healthCheck() {
        execute<Unit>(request("api/health"))
    }

    suspend fun skills(): List<Skill> {
        val type = object : TypeToken<List<Skill>>() {}.type
        return execute(request("api/skills"), type)
    }

    suspend fun generate(body: GenerateRequest): GenerateResult = post("api/generate", body)

    suspend fun posts(page: Int, pageSize: Int = 10): PostsPage =
        execute(request("api/community/posts?page=$page&pageSize=$pageSize"))

    suspend fun publish(
        image: String,
        sentence: String,
        author: String,
        title: String,
        description: String,
    ): CommunityPost = post<PostResponse>(
        "api/community/posts",
        mapOf(
            "image" to image,
            "sentence" to sentence,
            "author" to author,
            "title" to title,
            "description" to description,
        ),
    ).post

    suspend fun toggleLike(postId: String, visitorId: String): LikeResponse =
        post("api/community/posts/$postId/like", mapOf("user" to visitorId))

    suspend fun comments(postId: String): List<CommunityComment> =
        execute<CommentsResponse>(request("api/community/posts/$postId/comments")).comments

    suspend fun comment(postId: String, author: String, content: String): CommunityComment =
        post<CommentResponse>(
            "api/community/posts/$postId/comments",
            mapOf("author" to author, "content" to content),
        ).comment

    fun absoluteImageUrl(value: String): String {
        if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) return value
        return preferences.baseUrl.trimEnd('/') + "/" + value.trimStart('/')
    }

    suspend fun imageBytes(value: String): ByteArray {
        val request = Request.Builder().url(absoluteImageUrl(value)).get().build()
        return suspendCancellableCoroutine { continuation ->
            val call = client.newCall(request)
            continuation.invokeOnCancellation { call.cancel() }
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, error: IOException) {
                    if (continuation.isActive) continuation.resumeWithException(error)
                }

                override fun onResponse(call: Call, response: Response) {
                    response.use {
                        if (!it.isSuccessful) {
                            if (continuation.isActive) continuation.resumeWithException(IOException("HTTP ${it.code}"))
                            return
                        }
                        val bytes = it.body?.bytes()
                        if (bytes == null) {
                            if (continuation.isActive) continuation.resumeWithException(IOException("图片为空"))
                        } else if (continuation.isActive) continuation.resume(bytes)
                    }
                }
            })
        }
    }

    private fun request(path: String): Request = Request.Builder()
        .url(preferences.baseUrl + path)
        .get()
        .build()

    private suspend inline fun <reified T> post(path: String, body: Any): T {
        val request = Request.Builder()
            .url(preferences.baseUrl + path)
            .post(gson.toJson(body).toRequestBody(jsonType))
            .build()
        return execute(request)
    }

    private suspend inline fun <reified T> execute(request: Request): T =
        execute(request, object : TypeToken<T>() {}.type)

    private suspend fun <T> execute(request: Request, type: java.lang.reflect.Type): T =
        suspendCancellableCoroutine { continuation ->
            val call = client.newCall(request)
            continuation.invokeOnCancellation { call.cancel() }
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, error: IOException) {
                    if (continuation.isActive) continuation.resumeWithException(error)
                }

                override fun onResponse(call: Call, response: Response) {
                    response.use {
                        val raw = it.body?.string().orEmpty()
                        if (!it.isSuccessful) {
                            val message = runCatching { gson.fromJson(raw, ApiError::class.java).error }
                                .getOrDefault("HTTP ${it.code}")
                            if (continuation.isActive) continuation.resumeWithException(IOException(message))
                            return
                        }
                        if (type == Unit::class.java) {
                            @Suppress("UNCHECKED_CAST")
                            if (continuation.isActive) continuation.resume(Unit as T)
                            return
                        }
                        runCatching<T> { gson.fromJson(raw, type) }
                            .onSuccess { value -> if (continuation.isActive) continuation.resume(value) }
                            .onFailure { error -> if (continuation.isActive) continuation.resumeWithException(error) }
                    }
                }
            })
        }
}
