-- Create v_friends_with_profile view for optimized friend queries

create or replace view public.v_friends_with_profile as
select  
        f.user_id || '_' || f.friend_id   as friendship_id,
        case
          when f.user_id = auth.uid() then f.friend_id
          else f.user_id
        end                              as friend_id,
        p.username,
        p.display_name,
        p.avatar_url,
        p.bio,
        p.created_at                     as friend_since,
        f.created_at                     as friendship_created_at
from    friendships f
join    profiles p
      on p.id = case
                 when f.user_id = auth.uid() then f.friend_id
                 else f.user_id
               end
where   (f.user_id = auth.uid() OR f.friend_id = auth.uid());

-- Set view ownership and security
alter view public.v_friends_with_profile
    owner to postgres;
alter view public.v_friends_with_profile
    set (security_invoker = on);

-- Enable RLS on the view
alter view public.v_friends_with_profile enable row level security;

-- RLS policy (the WHERE clause in the view already enforces auth.uid())
create policy "Friends: self only"
  on public.v_friends_with_profile for select using (true);

-- Add index for performance on large friend graphs
create index if not exists idx_friendships_user_friend
  on public.friendships (user_id, friend_id);

create index if not exists idx_friendships_friend_user  
  on public.friendships (friend_id, user_id);