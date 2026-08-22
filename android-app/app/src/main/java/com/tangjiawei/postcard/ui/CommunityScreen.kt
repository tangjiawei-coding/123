package com.tangjiawei.postcard.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Send
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.tangjiawei.postcard.CommunityState
import com.tangjiawei.postcard.PostcardViewModel
import com.tangjiawei.postcard.data.CommunityPost
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun CommunityScreen(state: CommunityState, viewModel: PostcardViewModel, modifier: Modifier = Modifier) {
    when {
        state.loading && state.posts.isEmpty() -> Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        state.error != null && state.posts.isEmpty() -> Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(state.error, color = MaterialTheme.colorScheme.error)
                OutlinedButton(onClick = viewModel::refreshCommunity, modifier = Modifier.padding(top = 12.dp)) { Text("重新加载") }
            }
        }
        state.posts.isEmpty() -> Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("社区还没有作品", style = MaterialTheme.typography.titleLarge)
                Text("生成一张明信片并分享吧", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp))
            }
        }
        else -> LazyColumn(
            modifier = modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item { Text("${state.total} 篇作品", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            items(state.posts, key = { it.id }) { post ->
                CommunityCard(
                    post = post,
                    imageUrl = viewModel.imageUrl(post.image),
                    liked = post.likers.contains(viewModel.preferences.visitorId),
                    onOpen = { viewModel.openPost(post) },
                    onLike = { viewModel.toggleLike(post) },
                )
            }
            if (state.posts.size < state.total) {
                item {
                    OutlinedButton(onClick = viewModel::loadMore, enabled = !state.loading, modifier = Modifier.fillMaxWidth()) {
                        if (state.loading) CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                        else Text("加载更多")
                    }
                }
            }
        }
    }

    state.selectedPost?.let { post ->
        PostDetail(state, post, viewModel)
    }
}

@Composable
private fun CommunityCard(post: CommunityPost, imageUrl: String, liked: Boolean, onOpen: () -> Unit, onLike: () -> Unit) {
    Surface(onClick = onOpen, shape = RoundedCornerShape(6.dp), tonalElevation = 1.dp) {
        Column {
            AsyncImage(
                model = imageUrl,
                contentDescription = post.title,
                modifier = Modifier.fillMaxWidth().aspectRatio(4f / 3f),
                contentScale = ContentScale.Crop,
            )
            Column(Modifier.padding(16.dp)) {
                if (post.title.isNotBlank()) Text(post.title, style = MaterialTheme.typography.titleLarge)
                if (post.sentence.isNotBlank()) {
                    Text(
                        post.sentence,
                        style = MaterialTheme.typography.bodyLarge.copy(fontFamily = FontFamily.Serif),
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = if (post.title.isBlank()) 0.dp else 10.dp),
                    )
                }
                if (post.description.isNotBlank()) {
                    Text(post.description, maxLines = 2, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
                }
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(top = 14.dp)) {
                    Text(post.author, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    Text(formatTime(post.createdAt), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    IconButton(onClick = onLike) {
                        Icon(if (liked) Icons.Outlined.Favorite else Icons.Outlined.FavoriteBorder, "点赞", tint = if (liked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text(post.likes.toString())
                    Spacer(Modifier.width(12.dp))
                    Icon(Icons.Outlined.ChatBubbleOutline, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(post.commentCount.toString())
                }
            }
        }
    }
}

@Composable
private fun PostDetail(state: CommunityState, post: CommunityPost, viewModel: PostcardViewModel) {
    var comment by remember(post.id) { mutableStateOf("") }
    val liked = post.likers.contains(viewModel.preferences.visitorId)
    Dialog(onDismissRequest = viewModel::closePost, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(8.dp)) {
                    Text(post.title.ifBlank { "明信片详情" }, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f).padding(start = 8.dp))
                    IconButton(onClick = viewModel::closePost) { Icon(Icons.Outlined.Close, "关闭") }
                }
                LazyColumn(modifier = Modifier.weight(1f)) {
                    item {
                        AsyncImage(
                            model = viewModel.imageUrl(post.image),
                            contentDescription = post.title,
                            modifier = Modifier.fillMaxWidth().aspectRatio(1f),
                            contentScale = ContentScale.Crop,
                        )
                        Column(Modifier.padding(20.dp)) {
                            Text(post.author, fontWeight = FontWeight.SemiBold)
                            Text(formatTime(post.createdAt), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            if (post.sentence.isNotBlank()) Text(post.sentence, style = MaterialTheme.typography.titleLarge.copy(fontFamily = FontFamily.Serif), modifier = Modifier.padding(top = 18.dp))
                            if (post.description.isNotBlank()) Text(post.description, modifier = Modifier.padding(top = 12.dp))
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 10.dp)) {
                                IconButton(onClick = { viewModel.toggleLike(post) }) {
                                    Icon(if (liked) Icons.Outlined.Favorite else Icons.Outlined.FavoriteBorder, "点赞", tint = if (liked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                Text("${post.likes} 赞")
                            }
                        }
                        HorizontalDivider()
                        Text("评论 · ${state.comments.size}", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(20.dp))
                    }
                    if (state.commentsLoading) item { Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
                    items(state.comments, key = { it.id }) { item ->
                        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 10.dp)) {
                            Row {
                                Text(item.author, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                                Text(formatTime(item.createdAt), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Text(item.content, modifier = Modifier.padding(top = 5.dp))
                        }
                    }
                    item { Spacer(Modifier.height(20.dp)) }
                }
                Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                    OutlinedTextField(
                        value = comment,
                        onValueChange = { comment = it.take(300) },
                        label = { Text("写评论") },
                        maxLines = 3,
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(
                        enabled = comment.isNotBlank(),
                        onClick = { viewModel.sendComment(comment); comment = "" },
                        modifier = Modifier.padding(start = 6.dp),
                    ) { Icon(Icons.Outlined.Send, "发送") }
                }
            }
        }
    }
}

private fun formatTime(timestamp: Long): String =
    SimpleDateFormat("MM-dd HH:mm", Locale.getDefault()).format(Date(timestamp))
