package com.tangjiawei.postcard.data

data class Skill(
    val id: String,
    val name: String,
    val desc: String = "",
)

data class GenerateRequest(
    val image: String,
    val text: String,
    val mode: String,
    val skill: String,
)

data class GenerateResult(
    val image: String,
    val sentence: String,
)

data class CommunityPost(
    val id: String,
    val author: String,
    val title: String = "",
    val description: String = "",
    val sentence: String = "",
    val image: String,
    val likes: Int = 0,
    val likers: List<String> = emptyList(),
    val createdAt: Long,
    val commentCount: Int = 0,
)

data class PostsPage(
    val posts: List<CommunityPost> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val pageSize: Int = 10,
)

data class CommunityComment(
    val id: String,
    val postId: String,
    val author: String,
    val content: String,
    val createdAt: Long,
)

data class CommentsResponse(val comments: List<CommunityComment> = emptyList())
data class LikeResponse(val ok: Boolean, val likes: Int, val liked: Boolean)
data class PostResponse(val ok: Boolean, val post: CommunityPost)
data class CommentResponse(val ok: Boolean, val comment: CommunityComment)
data class ApiError(val error: String = "请求失败")
